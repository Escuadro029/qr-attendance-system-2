const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { getSettings, saveSettings } = require('../utils/certificateSettingsStore');

const router = express.Router();

const FIELDS = ['office_line', 'signatory_name', 'signatory_title', 'date_range', 'venue'];
const MAX_LENGTH = 200;
const MAX_CUSTOM_FIELDS = 20;
const MAX_CUSTOM_NAME_LENGTH = 60;
const MAX_SIGNATURE_DATA_LENGTH = 300_000; // ~225KB decoded — plenty for a small signature scan

function isValidSignature(signature) {
  if (signature === undefined || signature === null || signature === '') return true;
  if (typeof signature !== 'string' || signature.length > MAX_SIGNATURE_DATA_LENGTH) return false;
  // The signature is hosted on Cloudinary (see uploads.routes.js); the
  // data: form is only kept for backward compatibility with anything saved
  // before that migration.
  return /^data:image\/(png|jpe?g);base64,/.test(signature) || /^https:\/\/res\.cloudinary\.com\//.test(signature);
}

function isValidCustomFields(customFields) {
  if (customFields === undefined) return true;
  if (!Array.isArray(customFields) || customFields.length > MAX_CUSTOM_FIELDS) return false;
  return customFields.every(
    (f) =>
      f &&
      typeof f === 'object' &&
      typeof f.name === 'string' &&
      f.name.trim().length > 0 &&
      f.name.length <= MAX_CUSTOM_NAME_LENGTH &&
      typeof f.value === 'string' &&
      f.value.length <= MAX_LENGTH
  );
}

// GET /api/certificate-settings  (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await getSettings(req.user.tenant_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch certificate settings' });
  }
});

// PUT /api/certificate-settings  (admin only) -> upsert
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  const fields = {};
  for (const name of FIELDS) {
    const value = req.body[name];
    if (value !== undefined && value !== null && value !== '' && (typeof value !== 'string' || value.length > MAX_LENGTH)) {
      return res.status(400).json({ error: `${name} must be a string up to ${MAX_LENGTH} characters` });
    }
    fields[name] = typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  if (!isValidCustomFields(req.body.custom_fields)) {
    return res.status(400).json({
      error: `custom_fields must be a list of up to ${MAX_CUSTOM_FIELDS} { name, value } items (name up to ${MAX_CUSTOM_NAME_LENGTH} chars, value up to ${MAX_LENGTH} chars)`,
    });
  }
  fields.custom_fields = (req.body.custom_fields || [])
    .map((f) => ({ name: f.name.trim(), value: f.value.trim() }))
    .filter((f) => f.name);

  if (!isValidSignature(req.body.signatory_signature)) {
    return res.status(400).json({ error: 'signatory_signature must be a PNG or JPEG data URI' });
  }
  fields.signatory_signature = req.body.signatory_signature || null;

  try {
    res.json(await saveSettings(req.user.tenant_id, fields));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save certificate settings' });
  }
});

module.exports = router;
