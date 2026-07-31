const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const { renderCertificatePdf, renderRankingCertificatePdf, renderSpeakerCertificatePdf, renderTeacherCertificatePdf } = require('../utils/certificateGenerator');
const { DEFAULT_TEMPLATES } = require('../utils/certificateTemplateDefaults');
const { getTemplate, saveTemplate } = require('../utils/certificateTemplateStore');
const { getSettings } = require('../utils/certificateSettingsStore');

const router = express.Router();

const MAX_ELEMENTS = 60;
const VALID_ELEMENT_TYPES = ['text', 'shape', 'image'];
const VALID_ORIENTATIONS = ['portrait', 'landscape'];
const VALID_PAPER_SIZES = ['a4', 'short', 'long'];
const MAX_IMAGE_DATA_LENGTH = 500_000; // ~375KB decoded — plenty for a small logo

function isValidKey(key) {
  return Object.prototype.hasOwnProperty.call(DEFAULT_TEMPLATES, key);
}

function normalizeOrientation(orientation) {
  return VALID_ORIENTATIONS.includes(orientation) ? orientation : 'portrait';
}

function normalizePaperSize(paperSize) {
  return VALID_PAPER_SIZES.includes(paperSize) ? paperSize : 'short';
}

function isValidElements(elements) {
  if (!Array.isArray(elements) || elements.length === 0 || elements.length > MAX_ELEMENTS) return false;
  return elements.every((el) => {
    if (
      !el ||
      typeof el !== 'object' ||
      typeof el.id !== 'string' ||
      !VALID_ELEMENT_TYPES.includes(el.type) ||
      !Number.isFinite(el.x) ||
      !Number.isFinite(el.y) ||
      !Number.isFinite(el.width) ||
      !Number.isFinite(el.height)
    ) {
      return false;
    }
    if (el.type === 'image' && el.source === 'custom') {
      return (
        typeof el.imageData === 'string' &&
        el.imageData.length <= MAX_IMAGE_DATA_LENGTH &&
        // Uploaded logos are hosted on Cloudinary (see uploads.routes.js);
        // the data: form is only kept for backward compatibility with
        // anything saved before that migration.
        (/^data:image\/(png|jpe?g);base64,/.test(el.imageData) || /^https:\/\/res\.cloudinary\.com\//.test(el.imageData))
      );
    }
    return true;
  });
}

// GET /api/certificate-templates/:key  (admin only)
router.get('/:key', requireAuth, requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!isValidKey(key)) return res.status(400).json({ error: "key must be 'completion', 'ranking', 'speaker', or 'teacher'" });

  try {
    res.json(await getTemplate(req.user.tenant_id, key));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch certificate template' });
  }
});

// GET /api/certificate-templates/:key/defaults  (admin only) -> factory layout,
// powers the "Reset to Default Layout" button
router.get('/:key/defaults', requireAuth, requireAdmin, (req, res) => {
  const { key } = req.params;
  if (!isValidKey(key)) return res.status(400).json({ error: "key must be 'completion', 'ranking', 'speaker', or 'teacher'" });
  res.json(DEFAULT_TEMPLATES[key]);
});

// PUT /api/certificate-templates/:key  (admin only) -> upsert
router.put('/:key', requireAuth, requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!isValidKey(key)) return res.status(400).json({ error: "key must be 'completion', 'ranking', 'speaker', or 'teacher'" });
  if (!isValidElements(req.body.elements)) {
    return res.status(400).json({ error: `elements must be a non-empty array of valid positioned elements (max ${MAX_ELEMENTS})` });
  }

  try {
    res.json(await saveTemplate(
      req.user.tenant_id,
      key,
      req.body.elements,
      normalizeOrientation(req.body.orientation),
      normalizePaperSize(req.body.paper_size)
    ));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save certificate template' });
  }
});

// POST /api/certificate-templates/:key/preview.pdf  (admin only)
// Renders the *draft* (unsaved) elements array from the request body
// against placeholder sample data, so an admin can preview edits before
// saving them.
router.post('/:key/preview.pdf', requireAuth, requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!isValidKey(key)) return res.status(400).json({ error: "key must be 'completion', 'ranking', 'speaker', or 'teacher'" });
  if (!isValidElements(req.body.elements)) {
    return res.status(400).json({ error: `elements must be a non-empty array of valid positioned elements (max ${MAX_ELEMENTS})` });
  }

  const template = {
    elements: req.body.elements,
    orientation: normalizeOrientation(req.body.orientation),
    paper_size: normalizePaperSize(req.body.paper_size),
  };
  const sampleStudent = { full_name: 'Juan Dela Cruz', grade: '10', section: 'Rizal', qr_token: 'sample-preview-token' };

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'inline; filename="certificate-template-preview.pdf"');

  try {
    const settings = await getSettings(req.user.tenant_id);
    if (key === 'completion') {
      await renderCertificatePdf({
        student: sampleStudent,
        categoriesCompleted: 8,
        schoolName: 'Your School Name',
        dateRange: settings.date_range || 'August 1, 8, and 15, 2026',
        divisionName: settings.office_line,
        venue: settings.venue,
        signatoryName: settings.signatory_name,
        signatoryTitle: settings.signatory_title,
        customFields: settings.custom_fields,
        signatureDataUrl: settings.signatory_signature,
        template,
      }, res);
    } else if (key === 'ranking') {
      await renderRankingCertificatePdf({
        student: sampleStudent,
        categoryName: 'News Writing',
        rank: 1,
        schoolName: 'Your School Name',
        dateRange: settings.date_range,
        venue: settings.venue,
        officeLine: settings.office_line,
        signatoryName: settings.signatory_name,
        signatoryTitle: settings.signatory_title,
        customFields: settings.custom_fields,
        signatureDataUrl: settings.signatory_signature,
        template,
      }, res);
    } else if (key === 'speaker') {
      await renderSpeakerCertificatePdf({
        speaker: { full_name: 'Juan Dela Cruz', position: 'Senior Reporter', organization: 'Philippine Daily Inquirer', topic: 'The Future of Campus Journalism' },
        dateRange: settings.date_range,
        venue: settings.venue,
        officeLine: settings.office_line,
        signatoryName: settings.signatory_name,
        signatoryTitle: settings.signatory_title,
        customFields: settings.custom_fields,
        signatureDataUrl: settings.signatory_signature,
        template,
      }, res);
    } else {
      await renderTeacherCertificatePdf({
        teacher: { full_name: 'Juan Dela Cruz', role: 'Facilitator', department: 'Journalism Department', topic: 'News Writing Workshop' },
        dateRange: settings.date_range,
        venue: settings.venue,
        officeLine: settings.office_line,
        signatoryName: settings.signatory_name,
        signatoryTitle: settings.signatory_title,
        customFields: settings.custom_fields,
        signatureDataUrl: settings.signatory_signature,
        template,
      }, res);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to render certificate preview' });
  }
});

module.exports = router;
