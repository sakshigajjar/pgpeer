const cloudinary = require('cloudinary').v2;

// Fail fast at startup if any credential is missing — better than failing on the
// first upload request in production.
const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is not set in .env`);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,                                      // returns https URLs (never plain http)
});

module.exports = cloudinary;
