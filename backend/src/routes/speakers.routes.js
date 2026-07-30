const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { renderSpeakerCertificatePdf, buildSpeakerMergeData, buildCertificateDocDefinitionMultiSheet, streamPdf } = require('../utils/certificateGenerator');
const { safeFilename } = require('../utils/safeFilename');
const { getTemplate } = require('../utils/certificateTemplateStore');
const { getSettings } = require('../utils/certificateSettingsStore');

const router = express.Router();

// POST /api/speakers  -> register a speaker/lecturer
router.post('/', requireAuth, async (req, res) => {
  const { full_name, position, organization, topic } = req.body;
  if (!full_name) {
    return res.status(400).json({ error: 'full_name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO speakers (tenant_id, full_name, position, organization, topic)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.tenant_id, full_name, position || null, organization || null, topic || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register speaker' });
  }
});

// GET /api/speakers  -> list all
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM speakers WHERE tenant_id = $1 ORDER BY created_at DESC', [
      req.user.tenant_id,
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch speakers' });
  }
});

// DELETE /api/speakers/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM speakers WHERE id = $1 AND tenant_id = $2 RETURNING id', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Speaker not found' });
    res.json({ message: 'Speaker removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete speaker' });
  }
});

// GET /api/speakers/bulk.pdf?ids=uuid1,uuid2,...  (or ?ids=all)
// Two-per-sheet printable pack, same idea as /api/certificates/bulk.pdf —
// halves the bond paper needed when printing many speaker certificates.
router.get('/bulk.pdf', requireAuth, async (req, res) => {
  try {
    const idsParam = req.query.ids;
    let result;
    if (!idsParam || idsParam === 'all') {
      result = await pool.query('SELECT * FROM speakers WHERE tenant_id = $1 ORDER BY created_at DESC', [
        req.user.tenant_id,
      ]);
    } else {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length === 0) return res.status(400).json({ error: 'No speaker ids provided.' });
      result = await pool.query('SELECT * FROM speakers WHERE id = ANY($1::uuid[]) AND tenant_id = $2', [
        ids,
        req.user.tenant_id,
      ]);
    }

    if (result.rowCount === 0) return res.status(400).json({ error: 'No matching speakers found.' });

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'speaker'),
      getSettings(req.user.tenant_id),
    ]);

    const entries = result.rows.map((speaker) => {
      const { mergeData, controlNo } = buildSpeakerMergeData({
        speaker,
        eventName: req.query.event || 'School Press Conference',
        dateRange: req.query.dates || settings.date_range,
        venue: req.query.venue || settings.venue,
        officeLine: req.query.division || settings.office_line,
        signatoryName: req.query.signatory || settings.signatory_name,
        signatoryTitle: req.query.signatoryTitle || settings.signatory_title,
        customFields: settings.custom_fields,
      });
      return { elements: template.elements, mergeData, controlNo };
    });

    const docDefinition = await buildCertificateDocDefinitionMultiSheet(entries, {
      paperSize: template.paper_size,
      orientation: template.orientation,
    });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="speaker-certificates-2up.pdf"');
    await streamPdf(docDefinition, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate speaker certificate pack' });
  }
});

// GET /api/speakers/:id/certificate.pdf -> Certificate of Recognition
router.get('/:id/certificate.pdf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM speakers WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Speaker not found' });
    const speaker = result.rows[0];

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'speaker'),
      getSettings(req.user.tenant_id),
    ]);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="certificate-${safeFilename(speaker.full_name)}.pdf"`);
    await renderSpeakerCertificatePdf({
      speaker,
      eventName: req.query.event || 'School Press Conference',
      dateRange: req.query.dates || settings.date_range,
      venue: req.query.venue || settings.venue,
      officeLine: req.query.division || settings.office_line,
      signatoryName: req.query.signatory || settings.signatory_name,
      signatoryTitle: req.query.signatoryTitle || settings.signatory_title,
      customFields: settings.custom_fields,
      template,
    }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate speaker certificate' });
  }
});

module.exports = router;
