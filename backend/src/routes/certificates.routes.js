const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');
const { renderCertificatePdf } = require('../utils/certificateGenerator');

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
       GROUP BY s.id, s.full_name, s.grade, s.section
       HAVING COUNT(DISTINCT a.category_id) >= $1
       ORDER BY categories_completed DESC, s.full_name`,
      [QUALIFYING_THRESHOLD]
    );
    res.json({ threshold: QUALIFYING_THRESHOLD, qualified: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch qualified students' });
  }
});

// GET /api/certificates/:studentId.pdf -> generate certificate (only if qualified)
router.get('/:studentId.pdf', requireAuth, async (req, res) => {
  try {
    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.studentId]);
    if (studentRes.rowCount === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRes.rows[0];

    const countRes = await pool.query(
      'SELECT COUNT(DISTINCT category_id)::int AS c FROM attendance WHERE student_id = $1',
      [student.id]
    );
    const categoriesCompleted = countRes.rows[0].c;

    if (categoriesCompleted < QUALIFYING_THRESHOLD) {
      return res.status(403).json({
        error: `${student.full_name} has only completed ${categoriesCompleted} of ${QUALIFYING_THRESHOLD} required categories.`,
      });
    }

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="certificate-${student.full_name.replace(/\s+/g, '_')}.pdf"`);
    renderCertificatePdf({
      student,
      categoriesCompleted,
      schoolName: student.school_name,
      divisionName: req.query.division,
      dateRange: req.query.dates,
    }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

module.exports = router;
