const pool = require('../config/db');

const SELECT_COLUMNS = 'office_line, signatory_name, signatory_title, date_range, venue, event_name, custom_fields, signatory_signature, school_logo, updated_at';

// Returns the tenant's saved certificate settings, or an empty object if
// nothing has been saved yet (callers fall back to their own defaults).
async function getSettings(tenantId) {
  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM certificate_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0] || { custom_fields: [] };
}

async function saveSettings(tenantId, fields) {
  const result = await pool.query(
    `INSERT INTO certificate_settings (tenant_id, office_line, signatory_name, signatory_title, date_range, venue, event_name, custom_fields, signatory_signature, school_logo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tenant_id) DO UPDATE SET
       office_line = EXCLUDED.office_line,
       signatory_name = EXCLUDED.signatory_name,
       signatory_title = EXCLUDED.signatory_title,
       date_range = EXCLUDED.date_range,
       venue = EXCLUDED.venue,
       event_name = EXCLUDED.event_name,
       custom_fields = EXCLUDED.custom_fields,
       signatory_signature = EXCLUDED.signatory_signature,
       school_logo = EXCLUDED.school_logo,
       updated_at = now()
     RETURNING ${SELECT_COLUMNS}`,
    [
      tenantId,
      fields.office_line,
      fields.signatory_name,
      fields.signatory_title,
      fields.date_range,
      fields.venue,
      fields.event_name,
      JSON.stringify(fields.custom_fields || []),
      fields.signatory_signature,
      fields.school_logo,
    ]
  );
  return result.rows[0];
}

module.exports = { getSettings, saveSettings };
