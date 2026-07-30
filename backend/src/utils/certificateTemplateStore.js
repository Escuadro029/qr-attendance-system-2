const pool = require('../config/db');
const { DEFAULT_TEMPLATES } = require('./certificateTemplateDefaults');

// Returns the tenant's saved layout for this key, or the hardcoded defaults
// if the tenant hasn't customized it yet.
async function getTemplate(tenantId, key) {
  const result = await pool.query(
    'SELECT template_key, elements, orientation, paper_size, updated_at FROM certificate_templates WHERE tenant_id = $1 AND template_key = $2',
    [tenantId, key]
  );
  return result.rows[0] || DEFAULT_TEMPLATES[key];
}

async function saveTemplate(tenantId, key, elements, orientation, paperSize) {
  const result = await pool.query(
    `INSERT INTO certificate_templates (tenant_id, template_key, elements, orientation, paper_size)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, template_key) DO UPDATE SET
       elements = EXCLUDED.elements,
       orientation = EXCLUDED.orientation,
       paper_size = EXCLUDED.paper_size,
       updated_at = now()
     RETURNING template_key, elements, orientation, paper_size, updated_at`,
    [tenantId, key, JSON.stringify(elements), orientation, paperSize]
  );
  return result.rows[0];
}

module.exports = { getTemplate, saveTemplate };
