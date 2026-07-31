const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();

const MAX_DATA_URI_LENGTH = 2_000_000; // ~1.5MB decoded — generous ceiling; Cloudinary optimizes storage from there
const VALID_FOLDERS = new Set(['certificate-logos', 'certificate-signatures']);

function isValidDataUri(value) {
  return typeof value === 'string' && value.length <= MAX_DATA_URI_LENGTH && /^data:image\/(png|jpe?g);base64,/.test(value);
}

// POST /api/uploads/image  { dataUri, folder }  -> uploads to Cloudinary and
// returns the hosted URL. Used by the certificate designer's logo upload and
// Certificate Settings' e-signature upload, so images live in Cloudinary
// instead of as giant base64 blobs directly in Postgres.
router.post('/image', requireAuth, async (req, res) => {
  const { dataUri, folder } = req.body;
  if (!isValidDataUri(dataUri)) {
    return res.status(400).json({ error: 'dataUri must be a PNG or JPEG data URI' });
  }
  const targetFolder = VALID_FOLDERS.has(folder) ? folder : 'certificate-uploads';

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `press-files/${req.user.tenant_id}/${targetFolder}`,
      resource_type: 'image',
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
  }
});

module.exports = router;
