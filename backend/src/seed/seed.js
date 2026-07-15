const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const CATEGORIES = [
  'News Writing',
  'Feature Writing',
  'Editorial Writing',
  'Column Writing',
  'Copy Editing',
  'Sci-Tech Writing',
  'Photojournalism',
  'Editorial Cartooning',
  'Radio Broadcasting',
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('Applying schema...');
    const schema = fs.readFileSync(path.join(__dirname, '../config/schema.sql'), 'utf8');
    await client.query(schema);

    console.log('Seeding categories...');
    for (let i = 0; i < CATEGORIES.length; i++) {
      await client.query(
        `INSERT INTO categories (name, sort_order) VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [CATEGORIES[i], i]
      );
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@school.edu.ph';
    const adminPass = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rowCount === 0) {
      console.log(`Creating default teacher/admin account: ${adminEmail}`);
      const hash = await bcrypt.hash(adminPass, 10);
      await client.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')`,
        ['Press Conference Admin', adminEmail, hash]
      );
      console.log(`   Default password: ${adminPass} (change this after first login)`);
    } else {
      console.log('Admin account already exists, skipping.');
    }

    console.log('Seed complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
