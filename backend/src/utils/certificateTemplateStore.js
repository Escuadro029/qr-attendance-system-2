const pool = require('../config/db');
const { DEFAULT_TEMPLATES } = require('./certificateTemplateDefaults');

// Returns the tenant's saved layout for this key, or the hardcoded defaults
// if the tenant hasn't customized it yet.
async function getTemplate(tenantId, key) {
  const result = await pool.query(
    'SELECT template_key, elements, orientation, updated_at FROM certificate_templates WHERE tenant_id = $1 AND template_key = $2',
    [tenantId, key]
  );
  return result.rows[0] || DEFAULT_TEMPLATES[key];
}

async function saveTemplate(tenantId, key, elements, orientation) {
  const result = await pool.query(
    `INSERT INTO certificate_templates (tenant_id, template_key, elements, orientation)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, template_key) DO UPDATE SET
       elements = EXCLUDED.elements,
       orientation = EXCLUDED.orientation,
       updated_at = now()
     RETURNING template_key, elements, orientation, updated_at`,
    [tenantId, key, JSON.stringify(elements), orientation]
  );
  return result.rows[0];
}

module.exports = { getTemplate, saveTemplate };
