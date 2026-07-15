const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/categories
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY sort_order');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
