const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { renderRankingCertificatePdf, generateControlNo, buildRankingMergeData, buildCertificateDocDefinitionMultiSheet, streamPdf } = require('../utils/certificateGenerator');
const { safeFilename } = require('../utils/safeFilename');
const { getTemplate } = require('../utils/certificateTemplateStore');
const { getSettings } = require('../utils/certificateSettingsStore');
const { AWARD_SCHEMES, getAwardScheme, findAward } = require('../config/awardSchemes');
const { buildAwardsListDocDefinition } = require('../utils/awardsListPdf');

const router = express.Router();

// GET /api/category-awards/schemes -> the full award scheme config, so the
// frontend can render the right award-label dropdown per category without
// duplicating this list.
router.get('/schemes', requireAuth, (req, res) => {
  res.json(AWARD_SCHEMES);
});

// GET /api/category-awards -> every tagged award, joined with student + category names
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT ca.id, ca.category_id, c.name AS category_name, ca.student_id,
             s.full_name AS student_name, s.grade, s.section, ca.award_label, ca.control_no, ca.created_at
      FROM category_awards ca
      JOIN categories c ON c.id = ca.category_id
      JOIN students s ON s.id = ca.student_id
      WHERE ca.tenant_id = $1
      ORDER BY c.sort_order, ca.created_at
    `,
      [req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch awards' });
  }
});

// GET /api/category-awards/category/:categoryId -> awards for a single category
router.get('/category/:categoryId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT ca.id, ca.category_id, c.name AS category_name, ca.student_id,
             s.full_name AS student_name, s.grade, s.section, ca.award_label, ca.control_no
      FROM category_awards ca
      JOIN categories c ON c.id = ca.category_id
      JOIN students s ON s.id = ca.student_id
      WHERE ca.category_id = $1 AND ca.tenant_id = $2
      ORDER BY ca.created_at
    `,
      [req.params.categoryId, req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch category awards' });
  }
});

// POST /api/category-awards  { category_id, student_id, award_label }
// "Solo" awards (one student, e.g. "Best News Anchor") replace whoever
// currently holds them, same upsert behavior as numeric rankings. "Group"
// awards (e.g. "Champion") just add the student alongside anyone else
// already tagged for that award.
router.post('/', requireAuth, async (req, res) => {
  const { category_id, student_id, award_label } = req.body;
  if (!category_id || !student_id || !award_label) {
    return res.status(400).json({ error: 'category_id, student_id and award_label are required.' });
  }

  try {
    const catRes = await pool.query('SELECT name FROM categories WHERE id = $1 AND tenant_id = $2', [
      category_id,
      req.user.tenant_id,
    ]);
    if (catRes.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });

    const award = findAward(catRes.rows[0].name, award_label);
    if (!award) return res.status(400).json({ error: `"${award_label}" is not a valid award for this category.` });

    if (!award.group) {
      await pool.query('DELETE FROM category_awards WHERE category_id = $1 AND award_label = $2 AND tenant_id = $3', [
        category_id,
        award_label,
        req.user.tenant_id,
      ]);
    }

    const controlNo = generateControlNo('PRESSCONF-AWARD');
    const result = await pool.query(
      `INSERT INTO category_awards (tenant_id, category_id, student_id, award_label, control_no)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (category_id, award_label, student_id) DO NOTHING
       RETURNING *`,
      [req.user.tenant_id, category_id, student_id, award_label, controlNo]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'That student already holds this award.' });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save award' });
  }
});

// DELETE /api/category-awards/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM category_awards WHERE id = $1 AND tenant_id = $2 RETURNING id', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Award not found' });
    res.json({ message: 'Award removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete award' });
  }
});

// GET /api/category-awards/bulk.pdf?ids=uuid1,uuid2,...  (or ?ids=all)
// Same 2-per-sheet printable pack as /api/rankings/bulk.pdf, one certificate
// per tagged student (a "Champion" group of 4 students yields 4 certs).
router.get('/bulk.pdf', requireAuth, async (req, res) => {
  try {
    const idsParam = req.query.ids;
    let result;
    if (!idsParam || idsParam === 'all') {
      result = await pool.query(
        `SELECT ca.*, c.name AS category_name, s.full_name, s.grade, s.section, s.qr_token, s.school_name
         FROM category_awards ca
         JOIN categories c ON c.id = ca.category_id
         JOIN students s ON s.id = ca.student_id
         WHERE ca.tenant_id = $1
         ORDER BY c.sort_order, ca.created_at`,
        [req.user.tenant_id]
      );
    } else {
      const ids = idsParam.split(',').filter(Boolean);
      if (ids.length === 0) return res.status(400).json({ error: 'No award ids provided.' });
      result = await pool.query(
        `SELECT ca.*, c.name AS category_name, s.full_name, s.grade, s.section, s.qr_token, s.school_name
         FROM category_awards ca
         JOIN categories c ON c.id = ca.category_id
         JOIN students s ON s.id = ca.student_id
         WHERE ca.id = ANY($1::uuid[]) AND ca.tenant_id = $2
         ORDER BY c.sort_order, ca.created_at`,
        [ids, req.user.tenant_id]
      );
    }

    if (result.rowCount === 0) return res.status(400).json({ error: 'No matching awards found.' });

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'ranking'),
      getSettings(req.user.tenant_id),
    ]);

    const entries = result.rows.map((row) => {
      const { mergeData, controlNo } = buildRankingMergeData({
        student: { full_name: row.full_name, grade: row.grade, section: row.section, qr_token: row.qr_token },
        categoryName: row.category_name,
        awardLabel: row.award_label,
        eventName: req.query.event || settings.event_name || 'School Press Conference',
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
    res.set('Content-Disposition', 'inline; filename="award-certificates-2up.pdf"');
    await streamPdf(docDefinition, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate award certificate pack' });
  }
});

// GET /api/category-awards/list.pdf?category_id=123 -> square, social-media
// leaderboard graphic grouped by award label (each award can list several
// students, unlike the plain rank version in /api/rankings/list.pdf).
router.get('/list.pdf', requireAuth, async (req, res) => {
  const categoryId = req.query.category_id;
  if (!categoryId) return res.status(400).json({ error: 'category_id is required.' });

  try {
    const catRes = await pool.query('SELECT name FROM categories WHERE id = $1 AND tenant_id = $2', [
      categoryId,
      req.user.tenant_id,
    ]);
    if (catRes.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });
    const categoryName = catRes.rows[0].name;
    const scheme = getAwardScheme(categoryName);
    if (!scheme) return res.status(400).json({ error: 'This category does not use named awards.' });

    const result = await pool.query(
      `SELECT ca.award_label, s.full_name
       FROM category_awards ca
       JOIN students s ON s.id = ca.student_id
       WHERE ca.category_id = $1 AND ca.tenant_id = $2`,
      [categoryId, req.user.tenant_id]
    );

    if (result.rowCount === 0) return res.status(400).json({ error: 'No awards assigned for this category yet.' });

    const settings = await getSettings(req.user.tenant_id);

    const byLabel = new Map();
    for (const row of result.rows) {
      if (!byLabel.has(row.award_label)) byLabel.set(row.award_label, []);
      byLabel.get(row.award_label).push(row.full_name);
    }
    const awardGroups = scheme
      .map((a) => ({ label: a.label, students: byLabel.get(a.label) || [] }))
      .filter((g) => g.students.length > 0);

    const docDefinition = buildAwardsListDocDefinition({
      categoryName,
      awardGroups,
      eventName: req.query.event || settings.event_name || 'School Press Conference',
      dateRange: req.query.dates || settings.date_range,
      venue: req.query.venue || settings.venue,
    });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="awards-list-${safeFilename(categoryName)}.pdf"`);
    await streamPdf(docDefinition, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate awards list' });
  }
});

// GET /api/category-awards/:id/certificate.pdf -> single award certificate
// (reuses the same 'ranking' certificate template — the award label just
// replaces the {{rank_word}} merge field).
router.get('/:id/certificate.pdf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT ca.*, c.name AS category_name, s.full_name, s.grade, s.section, s.qr_token, s.school_name
      FROM category_awards ca
      JOIN categories c ON c.id = ca.category_id
      JOIN students s ON s.id = ca.student_id
      WHERE ca.id = $1 AND ca.tenant_id = $2
    `,
      [req.params.id, req.user.tenant_id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Award not found' });
    const row = result.rows[0];

    const [template, settings] = await Promise.all([
      getTemplate(req.user.tenant_id, 'ranking'),
      getSettings(req.user.tenant_id),
    ]);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="award-certificate-${safeFilename(row.full_name)}.pdf"`);

    await renderRankingCertificatePdf({
      student: { full_name: row.full_name, grade: row.grade, section: row.section, qr_token: row.qr_token },
      categoryName: row.category_name,
      awardLabel: row.award_label,
      eventName: req.query.event || settings.event_name || 'School Press Conference',
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
    res.status(500).json({ error: 'Failed to generate award certificate' });
  }
});

module.exports = router;
