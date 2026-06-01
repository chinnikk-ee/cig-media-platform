const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');

// ─── Lazy-load face-api to avoid crashing if models not yet downloaded ───────
let faceapi = null;
let faceModelsLoaded = false;

async function getFaceApi() {
  if (faceapi && faceModelsLoaded) return faceapi;

  try {
    const canvas = require('canvas');
    const fa = require('face-api.js');

    const { Canvas, Image, ImageData } = canvas;
    fa.env.monkeyPatch({ Canvas, Image, ImageData });

    const MODELS_PATH = path.join(__dirname, '../../models');
    await fa.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    await fa.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    await fa.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);

    faceapi = fa;
    faceModelsLoaded = true;
    console.log('✅ face-api.js models loaded');
    return faceapi;
  } catch (err) {
    console.warn('⚠️  face-api.js not available:', err.message);
    return null;
  }
}

// ─── UPLOAD MEDIA ────────────────────────────────────────────
const uploadMedia = async (req, res) => {
  try {
    const { event_id, is_public, caption } = req.body;
    if (!event_id) return res.status(400).json({ success: false, message: 'event_id is required' });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const { data: event } = await supabase.from('events').select('id, is_public').eq('id', event_id).single();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const uploadedMedia = [];

    for (const file of req.files) {
      // Upload to Cloudinary — request auto-tagging at upload time (free, built-in)
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `cig-platform/${event_id}`,
            resource_type: 'auto',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            // Cloudinary's built-in AI tagging — uses Google/AWS AI under the hood.
            // Enabled free on paid plans; on free plans tags array will just be empty.
            categorization: 'google_tagging',
            auto_tagging: 0.7, // confidence threshold 0–1
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });

      // Extract tags from Cloudinary response (works if auto_tagging is enabled on your plan)
      // Falls back to empty array gracefully if not available
      let ai_tags = [];
      if (uploadResult.resource_type === 'image') {
        if (Array.isArray(uploadResult.tags) && uploadResult.tags.length > 0) {
          ai_tags = uploadResult.tags.slice(0, 10);
        } else {
          // Fallback: extract meaningful words from the filename as basic tags
          ai_tags = getFilenameTags(file.originalname);
        }
      }

      const { data: media, error: dbError } = await supabase
        .from('media')
        .insert({
          event_id,
          uploaded_by: req.user.id,
          url: uploadResult.secure_url,
          thumbnail_url: cloudinary.url(uploadResult.public_id, {
            width: 400, height: 400, crop: 'fill', quality: 'auto',
          }),
          public_id: uploadResult.public_id,
          media_type: uploadResult.resource_type === 'video' ? 'video' : 'image',
          file_name: file.originalname,
          file_size: file.size,
          width: uploadResult.width,
          height: uploadResult.height,
          is_public: is_public !== undefined ? is_public === 'true' : event.is_public,
          ai_tags,
          caption,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      uploadedMedia.push(media);

      if (uploadResult.resource_type === 'image') {
        runFaceMatchForNewMedia(media, file.buffer).catch(err =>
          console.warn('Face match on upload failed:', err.message)
        );
      }
    }

    req.io.to(`event:${event_id}`).emit('new_media', {
      event_id,
      count: uploadedMedia.length,
      uploader: req.user.username,
    });

    res.status(201).json({
      success: true,
      message: `${uploadedMedia.length} file(s) uploaded successfully`,
      media: uploadedMedia,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

// ─── HELPER: Extract tags from filename as a fallback ────────
// e.g. "birthday_party_2024.jpg" → ["birthday", "party", "2024"]
const getFilenameTags = (filename) => {
  const stopWords = new Set(['img', 'image', 'photo', 'pic', 'dsc', 'jpg', 'png', 'jpeg', 'webp', 'copy']);
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .split(/[\s_\-.()\[\]]+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && isNaN(w))
    .slice(0, 5);
};

// ─── GET SINGLE MEDIA ────────────────────────────────────────
const getMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: media, error } = await supabase
      .from('media_with_counts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !media) return res.status(404).json({ success: false, message: 'Media not found' });
    if (!media.is_public && (!req.user || req.user.role === 'viewer')) {
      return res.status(403).json({ success: false, message: 'This media is private' });
    }

    const { data: comments } = await supabase
      .from('comments')
      .select('*, users(username, avatar_url)')
      .eq('media_id', id)
      .order('created_at', { ascending: true });

    const { data: tags } = await supabase
      .from('media_tags')
      .select('*, tagged_user:users!media_tags_tagged_user_fkey(id, username, avatar_url)')
      .eq('media_id', id);

    let is_liked = false, is_favourited = false;
    if (req.user) {
      const [likeRes, favRes] = await Promise.all([
        supabase.from('likes').select('id').eq('user_id', req.user.id).eq('media_id', id).single(),
        supabase.from('favourites').select('id').eq('user_id', req.user.id).eq('media_id', id).single(),
      ]);
      is_liked = !!likeRes.data;
      is_favourited = !!favRes.data;
    }

    res.json({ success: true, media: { ...media, comments, tags, is_liked, is_favourited } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch media' });
  }
};

// ─── DELETE MEDIA ────────────────────────────────────────────
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: media } = await supabase.from('media').select('*').eq('id', id).single();

    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
    if (media.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await cloudinary.uploader.destroy(media.public_id, { resource_type: media.media_type });
    await supabase.from('media').delete().eq('id', id);

    res.json({ success: true, message: 'Media deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete media' });
  }
};

// ─── DOWNLOAD WITH WATERMARK ─────────────────────────────────
const downloadMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: media } = await supabase
      .from('media')
      .select('*, events(name, club_name)')
      .eq('id', id)
      .single();

    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

    await supabase.from('media').update({ download_count: media.download_count + 1 }).eq('id', id);

    const imageResponse = await axios.get(media.url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    const clubName = media.events?.club_name || req.user?.club_name || 'CIG';
    const eventName = media.events?.name || 'Event';
    const userRole = req.user?.role || 'viewer';
    const watermarkText = `${clubName} | ${eventName} | ${userRole}`;

    const { width, height } = await sharp(imageBuffer).metadata();
    const fontSize = Math.max(20, Math.floor(width / 30));
    const svgWatermark = `
      <svg width="${width}" height="${height}">
        <style>
          .wm { fill: rgba(255,255,255,0.6); font-size: ${fontSize}px; font-family: Arial; font-weight: bold; }
        </style>
        <text x="50%" y="95%" text-anchor="middle" class="wm">${watermarkText}</text>
      </svg>`;

    const watermarked = await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgWatermark), gravity: 'south' }])
      .jpeg({ quality: 90 })
      .toBuffer();

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="cig-${media.file_name || id}.jpg"`,
    });
    res.send(watermarked);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ success: false, message: 'Failed to download media' });
  }
};

// ─── UPLOAD SELFIE ────────────────────────────────────────────
const uploadSelfie = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No selfie uploaded' });

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'cig-platform/selfies', transformation: [{ quality: 'auto' }] },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    await supabase
      .from('users')
      .update({ selfie_url: uploadResult.secure_url, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    runFaceMatchForUser(req.user.id, req.file.buffer).catch(err =>
      console.warn('Face match scan failed:', err.message)
    );

    res.json({
      success: true,
      message: 'Selfie uploaded. We\'re scanning for your photos — check "My Photos" soon!',
      selfie_url: uploadResult.secure_url,
    });
  } catch (err) {
    console.error('Selfie upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload selfie' });
  }
};

// ─── GET MY PHOTOS ────────────────────────────────────────────
const getMyPhotos = async (req, res) => {
  try {
    const { data: matches, error } = await supabase
      .from('face_matches')
      .select('*, media:media_id(*, events(name))')
      .eq('user_id', req.user.id)
      .order('confidence', { ascending: false });

    if (error) throw error;
    res.json({ success: true, photos: matches.map(m => m.media).filter(Boolean) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch your photos' });
  }
};

// ─── HELPER: Get face descriptor from image buffer (local, no API) ────────────
const getFaceDescriptor = async (imageBuffer) => {
  const fa = await getFaceApi();
  if (!fa) return null;

  try {
    const { createCanvas, loadImage } = require('canvas');
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const detection = await fa
      .detectSingleFace(canvas, new fa.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection ? detection.descriptor : null;
  } catch (err) {
    console.warn('Face descriptor extraction failed:', err.message);
    return null;
  }
};

const faceDistance = (d1, d2) => {
  if (!d1 || !d2 || d1.length !== d2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < d1.length; i++) sum += (d1[i] - d2[i]) ** 2;
  return Math.sqrt(sum);
};

const distanceToScore = (distance) => Math.max(0, Math.round((1 - distance / 0.6) * 100));

const downloadBuffer = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  return Buffer.from(response.data);
};

// ─── FACE MATCH: when a new photo is uploaded ────────────────────────────────
const runFaceMatchForNewMedia = async (media, imageBuffer) => {
  const fa = await getFaceApi();
  if (!fa) return;

  const { data: users } = await supabase
    .from('users')
    .select('id, selfie_url, face_descriptor')
    .not('selfie_url', 'is', null);

  if (!users || users.length === 0) return;

  const photoDescriptor = await getFaceDescriptor(imageBuffer);
  if (!photoDescriptor) return;

  const DISTANCE_THRESHOLD = 0.55;

  for (const user of users) {
    try {
      let selfieDescriptor;

      if (user.face_descriptor) {
        selfieDescriptor = new Float32Array(Object.values(user.face_descriptor));
      } else {
        const selfieBuffer = await downloadBuffer(user.selfie_url);
        selfieDescriptor = await getFaceDescriptor(selfieBuffer);
        if (selfieDescriptor) {
          await supabase
            .from('users')
            .update({ face_descriptor: Array.from(selfieDescriptor) })
            .eq('id', user.id);
        }
      }

      if (!selfieDescriptor) continue;

      const distance = faceDistance(selfieDescriptor, photoDescriptor);
      if (distance <= DISTANCE_THRESHOLD) {
        const confidence = distanceToScore(distance);
        await supabase.from('face_matches').upsert(
          { user_id: user.id, media_id: media.id, confidence },
          { onConflict: 'user_id,media_id' }
        );
      }
    } catch (err) {
      console.warn(`Face match failed for user ${user.id}:`, err.message);
    }
  }
};

// ─── FACE MATCH: when a user uploads their selfie ────────────────────────────
const runFaceMatchForUser = async (userId, selfieBuffer) => {
  const fa = await getFaceApi();
  if (!fa) return;

  await supabase.from('face_matches').delete().eq('user_id', userId);

  const selfieDescriptor = await getFaceDescriptor(selfieBuffer);
  if (!selfieDescriptor) {
    console.warn(`No face detected in selfie for user ${userId}`);
    return;
  }

  await supabase
    .from('users')
    .update({ face_descriptor: Array.from(selfieDescriptor) })
    .eq('id', userId);

  const { data: allMedia } = await supabase
    .from('media')
    .select('id, url')
    .eq('media_type', 'image')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!allMedia || allMedia.length === 0) return;

  const DISTANCE_THRESHOLD = 0.55;

  for (const media of allMedia) {
    try {
      const photoBuffer = await downloadBuffer(media.url);
      const photoDescriptor = await getFaceDescriptor(photoBuffer);
      if (!photoDescriptor) continue;

      const distance = faceDistance(selfieDescriptor, photoDescriptor);
      if (distance <= DISTANCE_THRESHOLD) {
        const confidence = distanceToScore(distance);
        await supabase.from('face_matches').upsert(
          { user_id: userId, media_id: media.id, confidence },
          { onConflict: 'user_id,media_id' }
        );
      }
    } catch (err) {
      console.warn(`Face match failed for media ${media.id}:`, err.message);
    }
  }
};

module.exports = { uploadMedia, getMedia, deleteMedia, downloadMedia, uploadSelfie, getMyPhotos };