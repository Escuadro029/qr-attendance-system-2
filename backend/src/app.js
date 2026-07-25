const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const studentsRoutes = require('./routes/students.routes');
const categoriesRoutes = require('./routes/categories.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const certificatesRoutes = require('./routes/certificates.routes');
const rankingsRoutes = require('./routes/rankings.routes');

const app = express();

// Render sits behind a reverse proxy; needed for express-rate-limit and
// req.ip to see the real client IP instead of the proxy's.
app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
}));
app.use(express.json());

// Login is the one unauthenticated, credential-checking endpoint, so it's
// the one worth throttling against brute-force/credential-stuffing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});
app.use('/api/auth/login', loginLimiter);

// Light global ceiling so no single client can hammer the API/DB.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'qr-attendance-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/rankings', rankingsRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler (last resort)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;