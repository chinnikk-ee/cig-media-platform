const { CompareFacesCommand, DetectFacesCommand, DetectLabelsCommand } = require('@aws-sdk/client-rekognition');
const sharp = require('sharp');
const axios = require('axios');
const rekognition = require('../config/rekognition');

// Minimum similarity (0-100) for two faces to be considered the same person.
// Rekognition recommends 80+ for identity matching; 85 keeps false positives low.
const FACE_MATCH_THRESHOLD = 85;

// Download an image by URL and normalise it for Rekognition:
//  - auto-rotate via EXIF
//  - downscale so we stay well under Rekognition's 5MB Bytes limit and run fast
//  - re-encode as JPEG
const fetchImageBytes = async (url) => {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return sharp(Buffer.from(res.data))
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
};

// Detect faces in an image (bytes). Returns an array of face detail objects.
const detectFaces = async (bytes) => {
  const out = await rekognition.send(
    new DetectFacesCommand({ Image: { Bytes: bytes }, Attributes: ['DEFAULT'] })
  );
  return out.FaceDetails || [];
};

// Detect content labels (objects, scenes, concepts) in an image (bytes).
// Returns up to `maxLabels` lowercase label names at/above `minConfidence`.
const detectLabels = async (bytes, { maxLabels = 10, minConfidence = 70 } = {}) => {
  const out = await rekognition.send(
    new DetectLabelsCommand({
      Image: { Bytes: bytes },
      MaxLabels: maxLabels,
      MinConfidence: minConfidence,
    })
  );
  return (out.Labels || []).map((l) => l.Name.toLowerCase());
};

// Compare a source face (e.g. a selfie) against every face in a target image.
// Returns the highest similarity (0-100) of any matching face, or null if none match.
const compareFaces = async (sourceBytes, targetBytes) => {
  try {
    const out = await rekognition.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: sourceBytes },
        TargetImage: { Bytes: targetBytes },
        SimilarityThreshold: FACE_MATCH_THRESHOLD,
      })
    );
    if (!out.FaceMatches || out.FaceMatches.length === 0) return null;
    return Math.max(...out.FaceMatches.map((m) => m.Similarity));
  } catch (err) {
    // InvalidParameterException is thrown when no face is found in the source
    // image — treat that as "no match" rather than a hard error.
    if (err.name === 'InvalidParameterException') return null;
    throw err;
  }
};

module.exports = {
  FACE_MATCH_THRESHOLD,
  fetchImageBytes,
  detectFaces,
  detectLabels,
  compareFaces,
};
