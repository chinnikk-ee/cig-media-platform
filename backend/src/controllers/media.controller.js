const cloudinary = require('../config/cloudinary');
const supabase = require('../config/supabase');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { detectFaces, compareFaces, fetchImageBytes } = require('../utils/faceRecognition');

// Cloudinary's synchronous upload endpoint (upload_stream) is capped at 10MB on
// this account. Larger files (e.g. videos) must use the chunked endpoint
// (upload_large), which uploads in parts. Each part must be > 5MiB and <= 10MiB,
// so we use a 6,000,000-byte chunk that sits safely inside that window.
const CHUNK_THRESHOLD = 9 * 1024 * 1024;        // switch to chunked just under the 10MB cap
const CHUNK_SIZE = 6000000;

// Upload a small buffer via the fast synchronous stream endpoint.
const uploadViaStream = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) =>
      err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });

// Upload a large buffer via the chunked endpoint. upload_large needs a file
// path, so we spill the buffer to a temp file and clean it up afterwards.
const uploadViaChunks = (buffer, options) =>
  new Promise((resolve, reject) => {
    const tmpPath = path.join(
      os.tmpdir(),
      `cig_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    fs.writeFile(tmpPath, buffer, (writeErr) => {
      if (writeErr) return reject(writeErr);
      cloudinary.uploader.upload_large(
        tmpPath,
        { ...options, chunk_size: CHUNK_SIZE },
        (err, result) => {
          fs.unlink(tmpPath, () => {}); // best-effort cleanup
          err ? reject(err) : resolve(result);
        }
      );
    });
  });

// Pick the right path based on file size.
const uploadToCloudinary = (file, options) =>
  file.size > CHUNK_THRESHOLD
    ? uploadViaChunks(file.buffer, options)
    : uploadViaStream(file.buffer, options);

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
      const isVideo = (file.mimetype || '').startsWith('video/');

      // Upload to Cloudinary (storage, thumbnails, watermarked downloads).
      // Small files go through the fast sync endpoint; large files are
      // uploaded in chunks to get past the 10MB sync limit.
      //
      // Large videos cannot be transformed synchronously during upload, so we
      // never pass an incoming `transformation` for video — instead we request
      // an async eager optimization (eager_async) that Cloudinary runs in the
      // background. Images keep the inline quality/format optimization.
      const uploadOptions = isVideo
        ? {
            folder: `cig-platform/${event_id}`,
            resource_type: 'video',
            eager: [{ quality: 'auto' }],
            eager_async: true,
          }
        : {
            folder: `cig-platform/${event_id}`,
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          };

      const uploadResult = await uploadToCloudinary(file, uploadOptions);

      // Insert the media row immediately after the Cloudinary upload so the
      // response can return fast. The expensive enrichment steps — Imagga AI
      // tagging, AWS Rekognition face detection, and face matching — are slow
      // external calls that don't need to block the upload request. They run
      // in the background (see enrichMedia) and patch the row when done.
      const { data: media, error: dbError } = await supabase
        .from('media')
        .insert({
          event_id,
          uploaded_by: req.user.id,
          url: uploadResult.secure_url,
          thumbnail_url: isVideo
            ? cloudinary.url(uploadResult.public_id, {
                resource_type: 'video', format: 'jpg',
                width: 400, height: 400, crop: 'fill', quality: 'auto',
              })
            : cloudinary.url(uploadResult.public_id, {
                width: 400, height: 400, crop: 'fill', quality: 'auto',
              }),
          public_id: uploadResult.public_id,
          media_type: isVideo ? 'video' : 'image',
          file_name: file.originalname,
          file_size: file.size,
          width: uploadResult.width,
          height: uploadResult.height,
          // Private events force every item private. Public events let the
          // uploader choose per upload (defaulting to public).
          is_public: event.is_public
            ? (is_public !== undefined ? is_public === 'true' : true)
            : false,
          // Cheap filename-based tags up front; Imagga tags overwrite these
          // in the background once available.
          ai_tags: getFilenameTags(file.originalname),
          caption,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      uploadedMedia.push(media);

      // Fire-and-forget background enrichment (tags + faces + matching).
      enrichMedia(media, file, uploadResult, req.io).catch(err =>
        console.warn('Media enrichment failed:', err.message)
      );
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

// ─── BACKGROUND ENRICHMENT ───────────────────────────────────
// Runs after the upload response has been sent. Fetches Imagga AI tags,
// detects faces (images only), updates the media row, then kicks off face
// matching against registered users. Failures here never affect the upload.
const enrichMedia = async (media, file, uploadResult, io) => {
  const update = {};

  // Imagga AI tags (falls back to the filename tags already stored on insert)
  try {
    const ai_tags = await getImaggaTags(uploadResult.secure_url);
    if (ai_tags && ai_tags.length > 0) update.ai_tags = ai_tags;
  } catch (_) { /* keep filename tags */ }

  // Face detection (images only)
  let faces_detected = [];
  let imageBytes = null;
  if (uploadResult.resource_type === 'image') {
    try {
      imageBytes = await sharp(file.buffer)
        .rotate()
        .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      const faces = await detectFaces(imageBytes);
      faces_detected = faces.map((f) => f.BoundingBox);
      if (faces_detected.length > 0) update.faces_detected = faces_detected;
    } catch (err) {
      console.warn('Face detection failed:', err.message);
    }
  }

  if (Object.keys(update).length > 0) {
    try {
      await supabase.from('media').update(update).eq('id', media.id);
    } catch (err) {
      console.warn('Media enrichment update failed:', err.message);
    }
  }

  // Match this new photo against every registered user's selfie
  if (faces_detected.length > 0 && imageBytes) {
    await runFaceMatchForNewMedia(media, imageBytes, io).catch(err =>
      console.warn('Face match failed:', err.message)
    );
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

    // Detect a face in the selfie with AWS Rekognition before storing it
    const selfieBytes = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const selfieFaces = await detectFaces(selfieBytes);
    if (selfieFaces.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No face detected in your selfie. Please upload a clear front-facing photo.',
      });
    }
    if (selfieFaces.length > 1) {
      // Face matching uses a single reference face. A group photo is ambiguous —
      // we can't tell which person to search for — so require a solo selfie.
      return res.status(400).json({
        success: false,
        message: `We detected ${selfieFaces.length} faces. Please upload a selfie of just YOUR face so we can find photos of you.`,
      });
    }

    // Upload selfie to Cloudinary (storage)
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'cig-platform/selfies', transformation: [{ quality: 'auto' }] },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    // Store selfie URL and detected face region (Rekognition bounding box)
    await supabase
      .from('users')
      .update({
        selfie_url: uploadResult.secure_url,
        face_data: {
          public_id: uploadResult.public_id,
          face_region: selfieFaces[0].BoundingBox,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id);

    // Run face matching in background using the normalised selfie bytes
    runFaceMatchForUser(req.user.id, selfieBytes, req.io).catch(err =>
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
    const photos = matches
      .filter(m => m.media)
      .map(m => ({ ...m.media, event_name: m.media.events?.name, confidence: m.confidence }));
    res.json({ success: true, photos });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch your photos' });
  }
};

// ─── FACE MATCH: Compare a user's selfie vs all existing photos ──
// Uses AWS Rekognition CompareFaces for real face-similarity matching.
const runFaceMatchForUser = async (userId, selfieBytes, io) => {
  try {
    // Let the user's page know a scan has started
    io?.to(`user:${userId}`).emit('face_match_started');

    // Clear old matches for this user
    await supabase.from('face_matches').delete().eq('user_id', userId);

    // Get all images. We don't filter on faces_detected: older photos were
    // uploaded before face detection existed (faces_detected is null), and
    // Rekognition CompareFaces safely returns "no match" for photos that
    // contain no matching face anyway.
    const { data: allMedia } = await supabase
      .from('media')
      .select('id, url, faces_detected')
      .eq('media_type', 'image')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!allMedia || allMedia.length === 0) return;

    let matchCount = 0;

    for (const media of allMedia) {
      try {
        const targetBytes = await fetchImageBytes(media.url);
        const similarity = await compareFaces(selfieBytes, targetBytes);
        if (similarity === null) continue;

        await supabase.from('face_matches').upsert(
          { user_id: userId, media_id: media.id, confidence: Math.round(similarity) },
          { onConflict: 'user_id,media_id' }
        );
        matchCount++;
      } catch (err) {
        console.warn(`Compare failed for media ${media.id}:`, err.message);
      }
    }

    console.log(`Face match complete for user ${userId}: ${matchCount} matches`);

    // Tell the user's page the scan finished so it can refresh live
    io?.to(`user:${userId}`).emit('face_match_complete', { count: matchCount });
  } catch (err) {
    console.error('runFaceMatchForUser error:', err.message);
    io?.to(`user:${userId}`).emit('face_match_complete', { count: 0, error: true });
  }
};

// ─── FACE MATCH: when a new photo is uploaded ────────────────
// Compares the new photo against every registered user's selfie.
const runFaceMatchForNewMedia = async (media, mediaBytes, io) => {
  try {
    // Get all users with a stored selfie
    const { data: users } = await supabase
      .from('users')
      .select('id, selfie_url')
      .not('selfie_url', 'is', null);

    if (!users || users.length === 0) return;

    for (const user of users) {
      try {
        const selfieBytes = await fetchImageBytes(user.selfie_url);
        const similarity = await compareFaces(selfieBytes, mediaBytes);
        if (similarity === null) continue;

        await supabase.from('face_matches').upsert(
          { user_id: user.id, media_id: media.id, confidence: Math.round(similarity) },
          { onConflict: 'user_id,media_id' }
        );

        // Notify this user that a new photo of them is available
        io?.to(`user:${user.id}`).emit('face_match_complete', { count: 1, newMedia: true });
      } catch (err) {
        console.warn(`Compare failed for user ${user.id}:`, err.message);
      }
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