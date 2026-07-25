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

    const tenantName = process.env.SEED_TENANT_NAME || 'The Press Conference School';
    const tenantIndustry = process.env.SEED_TENANT_INDUSTRY || 'education';

    console.log(`Resolving tenant: ${tenantName}`);
    const tenantExisting = await client.query('SELECT id FROM tenants WHERE name = $1', [tenantName]);
    let tenantId;
    if (tenantExisting.rowCount > 0) {
      tenantId = tenantExisting.rows[0].id;
    } else {
      const tenantInsert = await client.query(
        `INSERT INTO tenants (name, industry) VALUES ($1, $2) RETURNING id`,
        [tenantName, tenantIndustry]
      );
      tenantId = tenantInsert.rows[0].id;
      console.log(`Created tenant "${tenantName}" (${tenantIndustry})`);
    }

    console.log('Seeding categories...');
    for (let i = 0; i < CATEGORIES.length; i++) {
      await client.query(
        `INSERT INTO categories (tenant_id, name, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, CATEGORIES[i], i]
      );
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@school.edu.ph';
    const adminPass = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rowCount === 0) {
      console.log(`Creating default teacher/admin account: ${adminEmail}`);
      const hash = await bcrypt.hash(adminPass, 10);
      await client.query(
        `INSERT INTO users (tenant_id, full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'admin')`,
        [tenantId, 'Press Conference Admin', adminEmail, hash]
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
