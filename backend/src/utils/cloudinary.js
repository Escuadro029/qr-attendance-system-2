const cloudinary = require('cloudinary').v2;

// The SDK auto-configures itself from CLOUDINARY_URL
// (cloudinary://<api_key>:<api_secret>@<cloud_name>) the moment this module
// is required, if that env var is set. If a school prefers the three
// separate vars instead, wire those in explicitly here.
if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

module.exports = cloudinary;
