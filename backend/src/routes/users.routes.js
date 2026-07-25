const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/users  (admin only) -> create a new teacher/admin account
// tenant_id always comes from the admin's own token, never the request
// body, so an admin can only ever create accounts inside their own tenant.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { full_name, email, password, role } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email and password are required' });
  }
  if (role && !['teacher', 'admin'].includes(role)) {
    return res.status(400).json({ error: "role must be 'teacher' or 'admin'" });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (tenant_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, created_at`,
      [req.user.tenant_id, full_name, email, hash, role || 'teacher']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /api/users  (admin only) -> list all teacher/admin accounts in this tenant
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at',
      [req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /api/users/:id  (admin only) -> remove a teacher account
// Admins cannot delete their own account (avoids accidental lockout).
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account while logged in as it.' });
  }
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
