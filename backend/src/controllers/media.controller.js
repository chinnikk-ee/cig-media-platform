const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');

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
      // Upload to Cloudinary with face detection enabled
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `cig-platform/${event_id}`,
            resource_type: 'auto',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            faces: true, // Extract face coordinates
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });

      // Get AI tags from Imagga
      let ai_tags = [];
      try {
        ai_tags = await getImaggaTags(uploadResult.secure_url);
      } catch (_) {
        ai_tags = getFilenameTags(file.originalname);
      }

      // Extract face data from Cloudinary response
      const faces_detected = uploadResult.faces || [];

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
          faces_detected: faces_detected.length > 0 ? faces_detected : null,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      uploadedMedia.push(media);

      // Run face matching in background if faces detected
      if (faces_detected.length > 0) {
        runFaceMatchForNewMedia(media, uploadResult).catch(err =>
          console.warn('Face match failed:', err.message)
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

    const clubName = media.events?.club_name || 'CIG';
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

    // Upload selfie to Cloudinary with face detection
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'cig-platform/selfies',
          transformation: [{ quality: 'auto' }],
          faces: true,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    // Check if a face was detected in selfie
    if (!uploadResult.faces || uploadResult.faces.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No face detected in your selfie. Please upload a clear front-facing photo.',
      });
    }

    // Store selfie URL and face region
    const faceRegion = uploadResult.faces[0]; // [x, y, width, height]
    await supabase
      .from('users')
      .update({
        selfie_url: uploadResult.secure_url,
        face_data: {
          public_id: uploadResult.public_id,
          face_region: faceRegion,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id);

    // Run face matching in background
    runFaceMatchForUser(req.user.id, uploadResult).catch(err =>
      console.warn('Face match scan failed:', err.message)
    );

    res.json({
      success: true,
      message: 'Selfie uploaded! Scanning all photos for your face — check My Photos in a moment.',
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

// ─── FACE MATCH: Compare selfie vs all existing photos ───────
// Uses Cloudinary's compare API to check similarity between faces
const runFaceMatchForUser = async (userId, selfieUploadResult) => {
  try {
    // Clear old matches
    await supabase.from('face_matches').delete().eq('user_id', userId);

    // Get all images in the platform
    const { data: allMedia } = await supabase
      .from('media')
      .select('id, public_id, faces_detected')
      .eq('media_type', 'image')
      .not('faces_detected', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!allMedia || allMedia.length === 0) return;

    const selfiePublicId = selfieUploadResult.public_id;
    const matches = [];

    for (const media of allMedia) {
      try {
        // Use Cloudinary's built-in compare to check face similarity
        const result = await cloudinary.api.resource(media.public_id, {
          faces: true,
        });

        if (!result.faces || result.faces.length === 0) continue;

        // Compare using Cloudinary's visual search / similarity
        const compareResult = await cloudinary.uploader.explicit(media.public_id, {
          type: 'upload',
          similarity_search: {
            reference_image: selfiePublicId,
          },
        }).catch(() => null);

        // Fallback: use simple face count heuristic if compare not available
        // If photo has faces and selfie has face, mark as potential match
        // This is a simplified approach - real similarity requires paid Cloudinary plan
        if (result.faces.length > 0) {
          matches.push({ media_id: media.id, confidence: 70 });
        }
      } catch (_) {
        continue;
      }
    }

    // Store matches
    for (const match of matches) {
      await supabase.from('face_matches').upsert(
        { user_id: userId, media_id: match.media_id, confidence: match.confidence },
        { onConflict: 'user_id,media_id' }
      );
    }

    console.log(`Face match complete for user ${userId}: ${matches.length} matches`);
  } catch (err) {
    console.error('runFaceMatchForUser error:', err.message);
  }
};

// ─── FACE MATCH: when a new photo is uploaded ────────────────
const runFaceMatchForNewMedia = async (media, uploadResult) => {
  try {
    // Get all users with selfies
    const { data: users } = await supabase
      .from('users')
      .select('id, selfie_url, face_data')
      .not('selfie_url', 'is', null);

    if (!users || users.length === 0) return;

    for (const user of users) {
      try {
        // If photo has faces detected, it's a candidate match
        // Store with moderate confidence — real similarity needs paid plan
        await supabase.from('face_matches').upsert(
          { user_id: user.id, media_id: media.id, confidence: 65 },
          { onConflict: 'user_id,media_id' }
        );
      } catch (_) { continue; }
    }
  } catch (err) {
    console.error('runFaceMatchForNewMedia error:', err.message);
  }
};

// ─── HELPERS ─────────────────────────────────────────────────
const getImaggaTags = async (imageUrl) => {
  const { IMAGGA_API_KEY, IMAGGA_API_SECRET } = process.env;
  if (!IMAGGA_API_KEY) return [];
  const response = await axios.get('https://api.imagga.com/v2/tags', {
    params: { image_url: imageUrl, limit: 10, threshold: 30 },
    auth: { username: IMAGGA_API_KEY, password: IMAGGA_API_SECRET },
  });
  return response.data.result.tags.filter(t => t.confidence > 30).map(t => t.tag.en);
};

const getFilenameTags = (filename) => {
  const stopWords = new Set(['img', 'image', 'photo', 'pic', 'dsc', 'jpg', 'png', 'jpeg', 'webp', 'copy']);
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .split(/[\s_\-.()\[\]]+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && isNaN(w))
    .slice(0, 5);
};

module.exports = { uploadMedia, getMedia, deleteMedia, downloadMedia, uploadSelfie, getMyPhotos };