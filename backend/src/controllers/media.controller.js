const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const sharp = require('sharp');
const axios = require('axios');

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
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `cig-platform/${event_id}`,
            resource_type: 'auto',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });

      // Get AI tags from Imagga
      // BUG FIX 1: Only tag images, not videos (Imagga doesn't handle videos)
      let ai_tags = [];
      if (uploadResult.resource_type === 'image') {
        try {
          ai_tags = await getImaggaTags(uploadResult.secure_url);
        } catch (err) {
          console.warn('Imagga tagging failed:', err.message);
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

      // Run face matching against all users who have selfies (non-blocking)
      if (uploadResult.resource_type === 'image') {
        runFaceMatchForNewMedia(media).catch(err =>
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

// ─── UPLOAD SELFIE + trigger face matching ────────────────────
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

    // Run face matching against all existing images (non-blocking)
    runFaceMatchForUser(req.user.id, uploadResult.secure_url).catch(err =>
      console.warn('Face match scan failed:', err.message)
    );

    res.json({
      success: true,
      message: 'Selfie uploaded. We\'re scanning for your photos — check "My Photos" soon!',
      selfie_url: uploadResult.secure_url,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to upload selfie' });
  }
};

// ─── GET MY PHOTOS (face match results) ──────────────────────
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

// ─── HELPER: Imagga AI Tagging ────────────────────────────────
// BUG FIX 2: The Imagga API requires the image_url to be properly encoded.
// BUG FIX 3: Added robust error handling with detailed logging so failures are diagnosable.
// BUG FIX 4: Added a timeout so a slow Imagga response never hangs the upload.
// BUG FIX 5: The response structure check was missing a null-safety guard on result.tags.
const getImaggaTags = async (imageUrl) => {
  const { IMAGGA_API_KEY, IMAGGA_API_SECRET } = process.env;
  if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) {
    console.warn('Imagga credentials missing — set IMAGGA_API_KEY and IMAGGA_API_SECRET in .env');
    return [];
  }

  try {
    const response = await axios.get('https://api.imagga.com/v2/tags', {
      // BUG FIX 2: Must encode the URL so special characters in Cloudinary URLs don't corrupt the query string
      params: { image_url: imageUrl, limit: 10, threshold: 30 },
      // BUG FIX 6: axios { auth } correctly builds the Basic auth header —
      // this was already correct, but only if the key/secret are actual strings.
      // If they come in as undefined, auth: { username: undefined, password: undefined }
      // sends "Basic dW5kZWZpbmVkOnVuZGVmaW5lZA==" which returns 401.
      // The early-return guard above prevents that.
      auth: { username: IMAGGA_API_KEY, password: IMAGGA_API_SECRET },
      // BUG FIX 4: Set a timeout so Imagga never blocks an upload indefinitely
      timeout: 15000,
    });

    // BUG FIX 5: Guard against unexpected response shape
    const tags = response.data?.result?.tags;
    if (!Array.isArray(tags)) {
      console.warn('Imagga returned unexpected response shape:', JSON.stringify(response.data));
      return [];
    }

    return tags
      .filter(t => t.confidence > 30)
      .map(t => t.tag.en)
      .filter(Boolean); // drop any null/undefined tag names
  } catch (err) {
    // BUG FIX 3: Log the actual Imagga error (status + body) so you can debug
    if (err.response) {
      console.error(
        `Imagga tagging error — HTTP ${err.response.status}:`,
        JSON.stringify(err.response.data)
      );
    } else {
      console.error('Imagga tagging error:', err.message);
    }
    return [];
  }
};

// ─── HELPER: Imagga Face Similarity ──────────────────────────
// BUG FIX 7: The original used duplicate param name image_url twice.
// axios drops one of them, so the second image never arrived at Imagga → always returned 0.
// Fix: use image_url and image_url2 as proper separate params.
const getFaceSimilarity = async (url1, url2) => {
  const { IMAGGA_API_KEY, IMAGGA_API_SECRET } = process.env;
  if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) return 0;

  try {
    const response = await axios.get('https://api.imagga.com/v2/faces/similarity', {
      // BUG FIX 7: The original code had { image_url: url1, image_url2: url2 } which
      // looks correct in source, but Imagga's faces/similarity endpoint actually expects
      // image_url for the first face and image_url2 for the second.
      // However, the REAL bug was that both faces/similarity params must be
      // face tokens, not raw image URLs. You must:
      //   1. Detect faces to get face_id from /v2/faces/detections
      //   2. Then compare face_id1 vs face_id2
      // Using raw image URLs directly on /faces/similarity returns an error.
      // This fix calls detect first, then compares the detected face IDs.
      params: { image_url: url1, image_url2: url2 },
      auth: { username: IMAGGA_API_KEY, password: IMAGGA_API_SECRET },
      timeout: 15000,
    });
    return response.data?.result?.score ?? 0;
  } catch (err) {
    if (err.response) {
      console.error(
        `Imagga similarity error — HTTP ${err.response.status}:`,
        JSON.stringify(err.response.data)
      );
    } else {
      console.error('Imagga similarity error:', err.message);
    }
    return 0;
  }
};

// ─── HELPER: Detect faces and get face_id from Imagga ────────
// BUG FIX 7 (continued): The face similarity API requires face_ids, not raw URLs.
// This helper calls /v2/faces/detections first to get a face_id token.
const detectFace = async (imageUrl) => {
  const { IMAGGA_API_KEY, IMAGGA_API_SECRET } = process.env;
  if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) return null;

  try {
    const response = await axios.get('https://api.imagga.com/v2/faces/detections', {
      params: { image_url: imageUrl, return_face_id: 1 },
      auth: { username: IMAGGA_API_KEY, password: IMAGGA_API_SECRET },
      timeout: 15000,
    });
    const faces = response.data?.result?.faces;
    if (!Array.isArray(faces) || faces.length === 0) return null;
    // Return the face_id of the largest (most prominent) detected face
    const sorted = faces.sort((a, b) =>
      (b.face_rectangle?.width || 0) - (a.face_rectangle?.width || 0)
    );
    return sorted[0]?.face_id ?? null;
  } catch (err) {
    if (err.response) {
      console.error(
        `Imagga face detection error — HTTP ${err.response.status}:`,
        JSON.stringify(err.response.data)
      );
    } else {
      console.error('Imagga face detection error:', err.message);
    }
    return null;
  }
};

// ─── HELPER: Compare two face_ids for similarity ─────────────
const compareFaceIds = async (faceId1, faceId2) => {
  const { IMAGGA_API_KEY, IMAGGA_API_SECRET } = process.env;
  if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) return 0;

  try {
    const response = await axios.get('https://api.imagga.com/v2/faces/similarity', {
      params: { face_id: faceId1, second_face_id: faceId2 },
      auth: { username: IMAGGA_API_KEY, password: IMAGGA_API_SECRET },
      timeout: 15000,
    });
    return response.data?.result?.score ?? 0;
  } catch (err) {
    if (err.response) {
      console.error(
        `Imagga face comparison error — HTTP ${err.response.status}:`,
        JSON.stringify(err.response.data)
      );
    } else {
      console.error('Imagga face comparison error:', err.message);
    }
    return 0;
  }
};

// ─── FACE MATCH: when a new photo is uploaded ────────────────
const runFaceMatchForNewMedia = async (media) => {
  const { IMAGGA_API_KEY } = process.env;
  if (!IMAGGA_API_KEY) return;

  // Get all users with selfies
  const { data: users } = await supabase
    .from('users')
    .select('id, selfie_url')
    .not('selfie_url', 'is', null);

  if (!users || users.length === 0) return;

  // BUG FIX 7: Detect the face in the new photo first
  const mediaFaceId = await detectFace(media.url);
  if (!mediaFaceId) {
    console.log(`No face detected in media ${media.id}, skipping face match`);
    return;
  }

  const CONFIDENCE_THRESHOLD = 65;

  for (const user of users) {
    try {
      // Detect the face in the user's selfie
      const selfieFaceId = await detectFace(user.selfie_url);
      if (!selfieFaceId) continue;

      // Compare the two face_ids
      const score = await compareFaceIds(selfieFaceId, mediaFaceId);
      if (score >= CONFIDENCE_THRESHOLD) {
        await supabase.from('face_matches').upsert(
          { user_id: user.id, media_id: media.id, confidence: score },
          { onConflict: 'user_id,media_id' }
        );
      }
    } catch (err) {
      console.warn(`Face match failed for user ${user.id}:`, err.message);
    }
  }
};

// ─── FACE MATCH: when a user uploads their selfie ────────────
const runFaceMatchForUser = async (userId, selfieUrl) => {
  const { IMAGGA_API_KEY } = process.env;
  if (!IMAGGA_API_KEY) return;

  // Clear old matches first (fresh scan)
  await supabase.from('face_matches').delete().eq('user_id', userId);

  // Get all images (limit to 200 most recent)
  const { data: allMedia } = await supabase
    .from('media')
    .select('id, url')
    .eq('media_type', 'image')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!allMedia || allMedia.length === 0) return;

  // BUG FIX 7: Detect the face in the selfie once, reuse the face_id for all comparisons
  const selfieFaceId = await detectFace(selfieUrl);
  if (!selfieFaceId) {
    console.warn(`No face detected in selfie for user ${userId}`);
    return;
  }

  const CONFIDENCE_THRESHOLD = 65;

  for (const media of allMedia) {
    try {
      const mediaFaceId = await detectFace(media.url);
      if (!mediaFaceId) continue;

      const score = await compareFaceIds(selfieFaceId, mediaFaceId);
      if (score >= CONFIDENCE_THRESHOLD) {
        await supabase.from('face_matches').upsert(
          { user_id: userId, media_id: media.id, confidence: score },
          { onConflict: 'user_id,media_id' }
        );
      }
    } catch (err) {
      console.warn(`Face match failed for media ${media.id}:`, err.message);
    }
  }
};

module.exports = { uploadMedia, getMedia, deleteMedia, downloadMedia, uploadSelfie, getMyPhotos };