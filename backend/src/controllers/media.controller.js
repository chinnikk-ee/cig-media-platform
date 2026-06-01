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
      let ai_tags = [];
      try {
        ai_tags = await getImaggaTags(uploadResult.secure_url);
      } catch (_) {
        console.warn('Imagga tagging failed, skipping tags');
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
const getImaggaTags = async (imageUrl) => {
  const { IMAGGA_API_KEY, IMAGGA_API_SECRET } = process.env;
  if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) return [];

  const response = await axios.get('https://api.imagga.com/v2/tags', {
    params: { image_url: imageUrl, limit: 10, threshold: 30 },
    auth: { username: IMAGGA_API_KEY, password: IMAGGA_API_SECRET },
  });

  return response.data.result.tags
    .filter(t => t.confidence > 30)
    .map(t => t.tag.en);
};

// ─── HELPER: Imagga Face Similarity ──────────────────────────
const getFaceSimilarity = async (url1, url2) => {
  const { IMAGGA_API_KEY, IMAGGA_API_SECRET } = process.env;
  if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) return 0;

  try {
    const response = await axios.get('https://api.imagga.com/v2/faces/similarity', {
      params: { image_url: url1, image_url2: url2 },
      auth: { username: IMAGGA_API_KEY, password: IMAGGA_API_SECRET },
    });
    return response.data.result?.score ?? 0;
  } catch {
    return 0;
  }
};

// ─── FACE MATCH: when a new photo is uploaded ────────────────
// Compare new media against all users who have selfies
const runFaceMatchForNewMedia = async (media) => {
  const { IMAGGA_API_KEY } = process.env;
  if (!IMAGGA_API_KEY) return;

  // Get all users with selfies
  const { data: users } = await supabase
    .from('users')
    .select('id, selfie_url')
    .not('selfie_url', 'is', null);

  if (!users || users.length === 0) return;

  const CONFIDENCE_THRESHOLD = 65; // Minimum % to record a match

  for (const user of users) {
    try {
      const score = await getFaceSimilarity(user.selfie_url, media.url);
      if (score >= CONFIDENCE_THRESHOLD) {
        // Upsert so re-runs don't duplicate
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
// Scan all existing photos for this user's face
const runFaceMatchForUser = async (userId, selfieUrl) => {
  const { IMAGGA_API_KEY } = process.env;
  if (!IMAGGA_API_KEY) return;

  // Clear old matches first (fresh scan)
  await supabase.from('face_matches').delete().eq('user_id', userId);

  // Get all images (limit to 200 most recent to avoid rate limits)
  const { data: allMedia } = await supabase
    .from('media')
    .select('id, url')
    .eq('media_type', 'image')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!allMedia || allMedia.length === 0) return;

  const CONFIDENCE_THRESHOLD = 65;

  for (const media of allMedia) {
    try {
      const score = await getFaceSimilarity(selfieUrl, media.url);
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