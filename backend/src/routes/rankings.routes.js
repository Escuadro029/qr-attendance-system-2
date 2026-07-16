const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { renderRankingCertificatePdf, generateControlNo } = require('../utils/certificateGenerator');

const router = express.Router();

// POST /api/rankings  { category_id, student_id, rank }
// Upserts: if that (category, rank) slot is already taken, it's reassigned
// to the new student. Only ranks 1, 2, 3 are allowed.
router.post('/', requireAuth, async (req, res) => {
  const { category_id, student_id, rank } = req.body;
  if (!category_id || !student_id || ![1, 2, 3].includes(Number(rank))) {
    return res.status(400).json({ error: 'category_id, student_id and rank (1, 2, or 3) are required.' });
  }

  try {
    const controlNo = generateControlNo('PRESSCONF-RANK');
    const result = await pool.query(
      `INSERT INTO category_rankings (category_id, student_id, rank, control_no)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (category_id, rank)
       DO UPDATE SET student_id = EXCLUDED.student_id, control_no = category_rankings.control_no
       RETURNING *`,
      [category_id, student_id, rank, controlNo]
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
    const result = await pool.query(`
      SELECT r.id, r.category_id, c.name AS category_name, r.student_id,
             s.full_name AS student_name, s.grade, s.section, r.rank, r.control_no, r.created_at
      FROM category_rankings r
      JOIN categories c ON c.id = r.category_id
      JOIN students s ON s.id = r.student_id
      ORDER BY c.sort_order, r.rank
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// GET /api/rankings/category/:categoryId -> rankings for a single category
router.get('/category/:categoryId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.category_id, c.name AS category_name, r.student_id,
             s.full_name AS student_name, s.grade, s.section, r.rank, r.control_no
      FROM category_rankings r
      JOIN categories c ON c.id = r.category_id
      JOIN students s ON s.id = r.student_id
      WHERE r.category_id = $1
      ORDER BY r.rank
    `, [req.params.categoryId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch category rankings' });
  }
});

// DELETE /api/rankings/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM category_rankings WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Ranking not found' });
    res.json({ message: 'Ranking removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete ranking' });
  }
});

// GET /api/rankings/:id/certificate.pdf -> generate the ranking certificate
router.get('/:id/certificate.pdf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, c.name AS category_name, s.full_name, s.grade, s.section, s.qr_token, s.school_name
      FROM category_rankings r
      JOIN categories c ON c.id = r.category_id
      JOIN students s ON s.id = r.student_id
      WHERE r.id = $1
    `, [req.params.id]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Ranking not found' });
    const row = result.rows[0];

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="ranking-certificate-${row.full_name.replace(/\s+/g, '_')}.pdf"`);

    await renderRankingCertificatePdf({
      student: { full_name: row.full_name, grade: row.grade, section: row.section, qr_token: row.qr_token },
      categoryName: row.category_name,
      rank: row.rank,
      eventName: req.query.event || 'School Press Conference',
      dateRange: req.query.dates,
      venue: req.query.venue,
      schoolName: row.school_name,
      officeLine: req.query.division,
      signatoryName: req.query.signatory,
      signatoryTitle: req.query.signatoryTitle,
      controlNo: row.control_no,
    }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate ranking certificate' });
  }
});

module.exports = router;