const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { renderRankingCertificatePdf, generateControlNo, buildRankingMergeData, buildCertificateDocDefinitionMultiSheet, streamPdf } = require('../utils/certificateGenerator');
const { safeFilename } = require('../utils/safeFilename');
const { getTemplate } = require('../utils/certificateTemplateStore');
const { getSettings } = require('../utils/certificateSettingsStore');

const router = express.Router();

// POST /api/rankings  { category_id, student_id, rank }
// Upserts: if that (category, rank) slot is already taken, it's reassigned
// to the new student. Ranks 1 through 10 are allowed.
router.post('/', requireAuth, async (req, res) => {
  const { category_id, student_id, rank } = req.body;
  const rankNum = Number(rank);
  if (!category_id || !student_id || !Number.isInteger(rankNum) || rankNum < 1 || rankNum > 10) {
    return res.status(400).json({ error: 'category_id, student_id and rank (1 through 10) are required.' });
  }

  try {
    const controlNo = generateControlNo('PRESSCONF-RANK');
    const result = await pool.query(
      `INSERT INTO category_rankings (tenant_id, category_id, student_id, rank, control_no)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (category_id, rank)
       DO UPDATE SET student_id = EXCLUDED.student_id, control_no = category_rankings.control_no
       RETURNING *`,
      [req.user.tenant_id, category_id, student_id, rankNum, controlNo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save ranking' });
  }
});

// GET /api/rankings  -> all rankings, joined with student + category names
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT r.id, r.category_id, c.name AS category_name, r.student_id,
             s.full_name AS student_name, s.grade, s.section, r.rank, r.control_no, r.created_at
      FROM category_rankings r
      JOIN categories c ON c.id = r.category_id
      JOIN students s ON s.id = r.student_id
      WHERE r.tenant_id = $1
      ORDER BY c.sort_order, r.rank
    `,
      [req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// GET /api/rankings/category/:categoryId -> rankings for a single category
router.get('/category/:categoryId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT r.id, r.category_id, c.name AS category_name, r.student_id,
             s.full_name AS student_name, s.grade, s.section, r.rank, r.control_no
      FROM category_rankings r
      JOIN categories c ON c.id = r.category_id
      JOIN students s ON s.id = r.student_id
      WHERE r.category_id = $1 AND r.tenant_id = $2
      ORDER BY r.rank
    `,
      [req.params.categoryId, req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch category rankings' });
  }
});

// DELETE /api/rankings/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM category_rankings WHERE id = $1 AND tenant_id = $2 RETURNING id', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Ranking not found' });
    res.json({ message: 'Ranking removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete ranking' });
  }
});

// GET /api/rankings/bulk.pdf?ids=uuid1,uuid2,...  (or ?ids=all)
// Two-per-sheet printable pack, same idea as /api/certificates/bulk.pdf —
// halves the bond paper needed when printing many ranking certificates.
router.get('/bulk.pdf', requireAuth, async (req, res) => {
  try {
    const idsParam = req.query.ids;
    let result;
    if (!idsParam || idsParam === 'all') {
      result = await pool.query(
        `SELECT r.*, c.name AS category_name, s.full_name, s.grade, s.section, s.qr_token, s.school_name
         FROM category_rankings r
         JOIN categories c ON c.id = r.category_id
         JOIN students s ON s.id = r.student_id
         WHERE r.tenant_id = $1
         ORDER BY c.sort_order, r.rank`,
        [req.user.tenant_id]
      );
    } else {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length === 0) return res.status(400).json({ error: 'No ranking ids provided.' });
      result = await pool.query(
        `SELECT r.*, c.name AS category_name, s.full_name, s.grade, s.section, s.qr_token, s.school_name
         FROM category_rankings r
         JOIN categories c ON c.id = r.category_id
         JOIN students s ON s.id = r.student_id
         WHERE r.id = ANY($1::uuid[]) AND r.tenant_id = $2
         ORDER BY c.sort_order, r.rank`,
        [ids, req.user.tenant_id]
      );
    }

    if (result.rowCount === 0) return res.status(400).json({ error: 'No matching rankings found.' });

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'ranking'),
      getSettings(req.user.tenant_id),
    ]);

    const entries = result.rows.map((row) => {
      const { mergeData, controlNo } = buildRankingMergeData({
        student: { full_name: row.full_name, grade: row.grade, section: row.section, qr_token: row.qr_token },
        categoryName: row.category_name,
        rank: row.rank,
        eventName: req.query.event || 'School Press Conference',
        dateRange: req.query.dates || settings.date_range,
        venue: req.query.venue || settings.venue,
        schoolName: row.school_name,
        officeLine: req.query.division || settings.office_line,
        signatoryName: req.query.signatory || settings.signatory_name,
        signatoryTitle: req.query.signatoryTitle || settings.signatory_title,
        controlNo: row.control_no,
        customFields: settings.custom_fields,
      });
      return { elements: template.elements, mergeData, qrToken: row.qr_token, controlNo };
    });

    const docDefinition = await buildCertificateDocDefinitionMultiSheet(entries, {
      paperSize: template.paper_size,
      orientation: template.orientation,
      signatureDataUrl: settings.signatory_signature,
      logoDataUrl: settings.school_logo,
    });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="ranking-certificates-2up.pdf"');
    await streamPdf(docDefinition, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate ranking certificate pack' });
  }
});

// GET /api/rankings/:id/certificate.pdf -> generate the ranking certificate
router.get('/:id/certificate.pdf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT r.*, c.name AS category_name, s.full_name, s.grade, s.section, s.qr_token, s.school_name
      FROM category_rankings r
      JOIN categories c ON c.id = r.category_id
      JOIN students s ON s.id = r.student_id
      WHERE r.id = $1 AND r.tenant_id = $2
    `,
      [req.params.id, req.user.tenant_id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Ranking not found' });
    const row = result.rows[0];

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'ranking'),
      getSettings(req.user.tenant_id),
    ]);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="ranking-certificate-${safeFilename(row.full_name)}.pdf"`);

    await renderRankingCertificatePdf({
      student: { full_name: row.full_name, grade: row.grade, section: row.section, qr_token: row.qr_token },
      categoryName: row.category_name,
      rank: row.rank,
      eventName: req.query.event || 'School Press Conference',
      dateRange: req.query.dates || settings.date_range,
      venue: req.query.venue || settings.venue,
      schoolName: row.school_name,
      officeLine: req.query.division || settings.office_line,
      signatoryName: req.query.signatory || settings.signatory_name,
      signatoryTitle: req.query.signatoryTitle || settings.signatory_title,
      controlNo: row.control_no,
      customFields: settings.custom_fields,
      signatureDataUrl: settings.signatory_signature,
      logoDataUrl: settings.school_logo,
      template,
    }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate ranking certificate' });
  }
});

module.exports = router;
