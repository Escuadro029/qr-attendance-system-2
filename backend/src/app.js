const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const studentsRoutes = require('./routes/students.routes');
const categoriesRoutes = require('./routes/categories.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const certificatesRoutes = require('./routes/certificates.routes');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'qr-attendance-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/certificates', certificatesRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler (last resort)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
