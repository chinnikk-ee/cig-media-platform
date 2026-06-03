const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  // Default SDK timeout is 60s, which can cut off large video uploads on
  // slower connections. Raise it so chunked uploads have time to finish.
  timeout: 120000,
});

module.exports = cloudinary;
