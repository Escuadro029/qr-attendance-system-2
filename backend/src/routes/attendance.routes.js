const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/attendance/scan
// body: { qr_token, category_id, attendance_date? }
// This is what the teacher's scanner screen calls after: scan QR -> pick category -> "Record Attendance"
router.post('/scan', requireAuth, async (req, res) => {
  const { qr_token, category_id, attendance_date } = req.body;
  if (!qr_token || !category_id) {
    return res.status(400).json({ error: 'qr_token and category_id are required' });
  }

  try {
    const studentRes = await pool.query('SELECT * FROM students WHERE qr_token = $1', [qr_token]);
    if (studentRes.rowCount === 0) {
      return res.status(404).json({ error: 'QR code not recognized. Student not found.' });
    }
    const student = studentRes.rows[0];

    const categoryRes = await pool.query('SELECT * FROM categories WHERE id = $1', [category_id]);
    if (categoryRes.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    const category = categoryRes.rows[0];

    const date = attendance_date || new Date().toISOString().slice(0, 10);

    const existing = await pool.query(
      `SELECT id FROM attendance WHERE student_id = $1 AND category_id = $2 AND attendance_date = $3`,
      [student.id, category_id, date]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: `${student.full_name} is already recorded for "${category.name}" on ${date}.`,
      });
    }

    const inserted = await pool.query(
      `INSERT INTO attendance (student_id, category_id, recorded_by, attendance_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [student.id, category_id, req.user.id, date]
    );

    res.status(201).json({
      message: 'Attendance recorded.',
      student: { id: student.id, full_name: student.full_name, section: student.section },
      category: category.name,
      attendance: inserted.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// GET /api/attendance/progress -> distinct categories completed per student
router.get('/progress', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id AS student_id, s.full_name, s.grade, s.section,
             COUNT(DISTINCT a.category_id)::int AS categories_completed
      FROM students s
      LEFT JOIN attendance a ON a.student_id = s.id
      GROUP BY s.id, s.full_name, s.grade, s.section
      ORDER BY categories_completed DESC, s.full_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// GET /api/attendance/student/:studentId -> full history for one student
router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, c.name AS category_name
       FROM attendance a
       JOIN categories c ON c.id = a.category_id
       WHERE a.student_id = $1
       ORDER BY a.attendance_date, c.sort_order`,
      [req.params.studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

module.exports = router;
