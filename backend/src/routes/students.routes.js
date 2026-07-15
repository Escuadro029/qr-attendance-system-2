const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { generateQrPngBuffer } = require('../utils/qrGenerator');
const { renderIdCardPdf } = require('../utils/idCardGenerator');

const router = express.Router();

// POST /api/students  -> register a student, auto-generates qr_token (db default)
router.post('/', requireAuth, async (req, res) => {
  const { full_name, grade, section, lrn, student_id_no, school_name } = req.body;
  if (!full_name || !grade || !section) {
    return res.status(400).json({ error: 'full_name, grade and section are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO students (full_name, grade, section, lrn, student_id_no, school_name)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'Your School Name'))
       RETURNING *`,
      [full_name, grade, section, lrn || null, student_id_no || null, school_name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register student' });
  }
});

// GET /api/students  -> list all (with optional ?search=)
router.get('/', requireAuth, async (req, res) => {
  const { search } = req.query;
  try {
    const result = search
      ? await pool.query(
          `SELECT * FROM students WHERE full_name ILIKE $1 OR section ILIKE $1 ORDER BY full_name`,
          [`%${search}%`]
        )
      : await pool.query('SELECT * FROM students ORDER BY grade, section, full_name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// GET /api/students/:id/qrcode.png  -> raw QR PNG (encodes only qr_token)
router.get('/:id/qrcode.png', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT qr_token FROM students WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Student not found' });

    const buffer = await generateQrPngBuffer(result.rows[0].qr_token);
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// GET /api/students/:id/id-card.pdf -> printable, DepEd-aligned ID card with QR
router.get('/:id/id-card.pdf', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Student not found' });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="id-card-${req.params.id}.pdf"`);
    await renderIdCardPdf(result.rows[0], res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate ID card' });
  }
});

module.exports = router;
