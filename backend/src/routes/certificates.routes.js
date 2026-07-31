const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { renderCertificatePdf, buildCompletionMergeData, buildCertificateDocDefinitionMultiSheet, streamPdf } = require('../utils/certificateGenerator');
const { safeFilename } = require('../utils/safeFilename');
const { getTemplate } = require('../utils/certificateTemplateStore');
const { getSettings } = require('../utils/certificateSettingsStore');

const router = express.Router();
const QUALIFYING_THRESHOLD = 6;

// GET /api/certificates/qualified -> students with >= 6 distinct categories
router.get('/qualified', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id AS student_id, s.full_name, s.grade, s.section,
              COUNT(DISTINCT a.category_id)::int AS categories_completed
       FROM students s
       JOIN attendance a ON a.student_id = s.id
       WHERE s.tenant_id = $1
       GROUP BY s.id, s.full_name, s.grade, s.section
       HAVING COUNT(DISTINCT a.category_id) >= $2
       ORDER BY categories_completed DESC, s.full_name`,
      [req.user.tenant_id, QUALIFYING_THRESHOLD]
    );
    res.json({ threshold: QUALIFYING_THRESHOLD, qualified: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch qualified students' });
  }
});

// GET /api/certificates/sample.pdf -> preview certificate with placeholder data
// (must be registered before /:studentId.pdf, which would otherwise treat
// "sample" as a studentId and shadow this route)
router.get('/sample.pdf', requireAuth, async (req, res) => {
  const settings = await getSettings(req.user.tenant_id);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'inline; filename="certificate-sample.pdf"');
  renderCertificatePdf({
    student: { full_name: 'Juan Dela Cruz', grade: '10', section: 'Rizal' },
    categoriesCompleted: 8,
    schoolName: req.query.school || 'Your School Name',
    divisionName: req.query.division || settings.office_line || 'Schools Division Office',
    dateRange: req.query.dates || settings.date_range || 'August 1, 8, and 15, 2026',
    venue: settings.venue,
    signatoryName: settings.signatory_name,
    signatoryTitle: settings.signatory_title,
    customFields: settings.custom_fields,
    signatureDataUrl: settings.signatory_signature,
    logoDataUrl: settings.school_logo,
  }, res);
});

// GET /api/certificates/bulk.pdf?ids=uuid1,uuid2,...  (or ?ids=all)
// Two-per-sheet printable pack: each qualified student's certificate is
// scaled to half size and stacked with another's on one physical sheet
// (same paper size/orientation as the saved template), with a dashed
// cut-line between — halves the bond paper needed versus one page each.
// Must be registered before /:studentId.pdf, which would otherwise treat
// "bulk" as a studentId and shadow this route.
router.get('/bulk.pdf', requireAuth, async (req, res) => {
  try {
    const idsParam = req.query.ids;
    let result;
    if (!idsParam || idsParam === 'all') {
      result = await pool.query(
        `SELECT s.*, COUNT(DISTINCT a.category_id)::int AS categories_completed
         FROM students s
         JOIN attendance a ON a.student_id = s.id
         WHERE s.tenant_id = $1
         GROUP BY s.id
         HAVING COUNT(DISTINCT a.category_id) >= $2
         ORDER BY s.grade, s.section, s.full_name`,
        [req.user.tenant_id, QUALIFYING_THRESHOLD]
      );
    } else {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length === 0) return res.status(400).json({ error: 'No student ids provided.' });
      result = await pool.query(
        `SELECT s.*, COUNT(DISTINCT a.category_id)::int AS categories_completed
         FROM students s
         JOIN attendance a ON a.student_id = s.id
         WHERE s.id = ANY($1::uuid[]) AND s.tenant_id = $2
         GROUP BY s.id
         HAVING COUNT(DISTINCT a.category_id) >= $3
         ORDER BY s.grade, s.section, s.full_name`,
        [ids, req.user.tenant_id, QUALIFYING_THRESHOLD]
      );
    }

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'None of the selected students have qualified for a certificate yet.' });
    }

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'completion'),
      getSettings(req.user.tenant_id),
    ]);

    const entries = result.rows.map((student) => {
      const { mergeData, controlNo } = buildCompletionMergeData({
        student,
        categoriesCompleted: student.categories_completed,
        schoolName: student.school_name,
        divisionName: req.query.division || settings.office_line,
        dateRange: req.query.dates || settings.date_range,
        venue: settings.venue,
        signatoryName: settings.signatory_name,
        signatoryTitle: settings.signatory_title,
        customFields: settings.custom_fields,
      });
      return { elements: template.elements, mergeData, qrToken: student.qr_token, controlNo };
    });

    const docDefinition = await buildCertificateDocDefinitionMultiSheet(entries, {
      paperSize: template.paper_size,
      orientation: template.orientation,
      signatureDataUrl: settings.signatory_signature,
      logoDataUrl: settings.school_logo,
    });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="certificates-2up.pdf"');
    await streamPdf(docDefinition, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate certificate pack' });
  }
});

// GET /api/certificates/:studentId.pdf -> generate certificate (only if qualified)
router.get('/:studentId.pdf', requireAuth, async (req, res) => {
  try {
    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1 AND tenant_id = $2', [
      req.params.studentId,
      req.user.tenant_id,
    ]);
    if (studentRes.rowCount === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRes.rows[0];

    const countRes = await pool.query(
      'SELECT COUNT(DISTINCT category_id)::int AS c FROM attendance WHERE student_id = $1 AND tenant_id = $2',
      [student.id, req.user.tenant_id]
    );
    const categoriesCompleted = countRes.rows[0].c;

    if (categoriesCompleted < QUALIFYING_THRESHOLD) {
      return res.status(403).json({
        error: `${student.full_name} has only completed ${categoriesCompleted} of ${QUALIFYING_THRESHOLD} required categories.`,
      });
    }

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'completion'),
      getSettings(req.user.tenant_id),
    ]);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="certificate-${safeFilename(student.full_name)}.pdf"`);
    renderCertificatePdf({
      student,
      categoriesCompleted,
      schoolName: student.school_name,
      divisionName: req.query.division || settings.office_line,
      dateRange: req.query.dates || settings.date_range,
      venue: settings.venue,
      signatoryName: settings.signatory_name,
      signatoryTitle: settings.signatory_title,
      customFields: settings.custom_fields,
      signatureDataUrl: settings.signatory_signature,
      logoDataUrl: settings.school_logo,
      template,
    }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

module.exports = router;