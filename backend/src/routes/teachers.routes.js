const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { renderTeacherCertificatePdf, buildTeacherMergeData, buildCertificateDocDefinitionMultiSheet, streamPdf } = require('../utils/certificateGenerator');
const { safeFilename } = require('../utils/safeFilename');
const { getTemplate } = require('../utils/certificateTemplateStore');
const { getSettings } = require('../utils/certificateSettingsStore');

const router = express.Router();

// POST /api/teachers  -> register a teacher's participation
router.post('/', requireAuth, async (req, res) => {
  const { full_name, role, department, topic } = req.body;
  if (!full_name) {
    return res.status(400).json({ error: 'full_name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO teachers (tenant_id, full_name, role, department, topic)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.tenant_id, full_name, role || null, department || null, topic || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register teacher' });
  }
});

// GET /api/teachers  -> list all
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers WHERE tenant_id = $1 ORDER BY created_at DESC', [
      req.user.tenant_id,
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// DELETE /api/teachers/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM teachers WHERE id = $1 AND tenant_id = $2 RETURNING id', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Teacher not found' });
    res.json({ message: 'Teacher removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// GET /api/teachers/bulk.pdf?ids=uuid1,uuid2,...  (or ?ids=all)
// Two-per-sheet printable pack, same idea as /api/certificates/bulk.pdf —
// halves the bond paper needed when printing many teacher certificates.
router.get('/bulk.pdf', requireAuth, async (req, res) => {
  try {
    const idsParam = req.query.ids;
    let result;
    if (!idsParam || idsParam === 'all') {
      result = await pool.query('SELECT * FROM teachers WHERE tenant_id = $1 ORDER BY created_at DESC', [
        req.user.tenant_id,
      ]);
    } else {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length === 0) return res.status(400).json({ error: 'No teacher ids provided.' });
      result = await pool.query('SELECT * FROM teachers WHERE id = ANY($1::uuid[]) AND tenant_id = $2', [
        ids,
        req.user.tenant_id,
      ]);
    }

    if (result.rowCount === 0) return res.status(400).json({ error: 'No matching teachers found.' });

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'teacher'),
      getSettings(req.user.tenant_id),
    ]);

    const entries = result.rows.map((teacher) => {
      const { mergeData, controlNo } = buildTeacherMergeData({
        teacher,
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
    res.set('Content-Disposition', 'inline; filename="teacher-certificates-2up.pdf"');
    await streamPdf(docDefinition, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate teacher certificate pack' });
  }
});

// GET /api/teachers/:id/certificate.pdf -> Certificate of Appreciation
router.get('/:id/certificate.pdf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Teacher not found' });
    const teacher = result.rows[0];

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'teacher'),
      getSettings(req.user.tenant_id),
    ]);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="certificate-${safeFilename(teacher.full_name)}.pdf"`);
    await renderTeacherCertificatePdf({
      teacher,
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
    res.status(500).json({ error: 'Failed to generate teacher certificate' });
  }
});

module.exports = router;
