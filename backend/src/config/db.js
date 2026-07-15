const { Pool } = require('pg');
require('dotenv').config();

// Render Postgres requires SSL in production. Locally (no DATABASE_URL host of
// render.com) we skip strict SSL so it also works with a local Postgres/docker db.
const isRenderHost = (process.env.DATABASE_URL || '').includes('render.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRenderHost || process.env.PGSSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
