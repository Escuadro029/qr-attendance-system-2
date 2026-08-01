-- Named awards (e.g. "Champion", "Best News Anchor") for categories that
-- don't fit the plain 1st-10th ranking model — currently Radio Broadcasting
-- and Scriptwriting. Unlike category_rankings, award_label is NOT unique
-- per category: multiple rows (multiple students) can share the same
-- award_label for "group" awards (e.g. a broadcast team's "Champion"); the
-- API layer enforces the solo/group distinction per backend/src/config/awardSchemes.js.
CREATE TABLE IF NOT EXISTS category_awards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  category_id   INT  NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  award_label   VARCHAR(60) NOT NULL,
  control_no    VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, award_label, student_id)
);

DROP TRIGGER IF EXISTS trg_category_awards_tenant_consistency ON category_awards;
CREATE TRIGGER trg_category_awards_tenant_consistency
  BEFORE INSERT OR UPDATE ON category_awards
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_consistency();

CREATE INDEX IF NOT EXISTS idx_category_awards_category ON category_awards(category_id);
CREATE INDEX IF NOT EXISTS idx_category_awards_tenant ON category_awards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_category_awards_student ON category_awards(student_id);

-- Add the "Scriptwriting" category to every existing tenant that doesn't
-- already have one (schema.sql/seed.js only seed a brand-new tenant; this
-- backfills tenants that already existed before this migration).
INSERT INTO categories (tenant_id, name, sort_order)
SELECT t.id, 'Scriptwriting', COALESCE((SELECT MAX(c.sort_order) + 1 FROM categories c WHERE c.tenant_id = t.id), 0)
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.tenant_id = t.id AND c.name = 'Scriptwriting'
);
