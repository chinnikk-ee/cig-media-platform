const { RekognitionClient } = require('@aws-sdk/client-rekognition');

// AWS Rekognition client — used for face detection and face matching.
// Requires AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env
const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = rekognition;
