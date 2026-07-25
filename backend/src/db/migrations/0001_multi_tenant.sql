-- Retrofit multi-tenancy onto the existing single-tenant schema.
--
-- Guarded so this is a safe no-op against a fresh database where
-- schema.sql already created tenant_id NOT NULL from the start (schema.sql
-- is the source of truth for brand-new installs; this migration exists
-- only to bring an already-populated database up to the same shape).
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'tenant_id'
  ) THEN
    RAISE NOTICE 'tenant_id already present -- skipping multi-tenant backfill.';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    industry    VARCHAR(50) NOT NULL DEFAULT 'education',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- One tenant representing everything that already exists today.
  INSERT INTO tenants (name, industry) VALUES ('Default School', 'education')
  RETURNING id INTO default_tenant_id;

  ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  ALTER TABLE students ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  ALTER TABLE categories ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  ALTER TABLE attendance ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  ALTER TABLE category_rankings ADD COLUMN tenant_id UUID REFERENCES tenants(id);

  UPDATE users SET tenant_id = default_tenant_id;
  UPDATE students SET tenant_id = default_tenant_id;
  UPDATE categories SET tenant_id = default_tenant_id;
  UPDATE attendance SET tenant_id = default_tenant_id;
  UPDATE category_rankings SET tenant_id = default_tenant_id;

  ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE students ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE categories ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE attendance ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE category_rankings ALTER COLUMN tenant_id SET NOT NULL;

  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
  ALTER TABLE categories ADD CONSTRAINT categories_tenant_name_key UNIQUE (tenant_id, name);

  CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_rankings_tenant ON category_rankings(tenant_id);
END $$;

-- Defense-in-depth: tenant_id is denormalized onto attendance/category_rankings
-- (not only derived via join) for simpler/faster scoped queries. This guards
-- against a bug ever inserting a tenant_id that doesn't match the referenced
-- student's/category's actual tenant. Runs unconditionally (idempotent via
-- OR REPLACE / DROP IF EXISTS) since a fresh DB via schema.sql needs this too.
CREATE OR REPLACE FUNCTION enforce_tenant_consistency() RETURNS trigger AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    IF NEW.tenant_id <> (SELECT tenant_id FROM students WHERE id = NEW.student_id) THEN
      RAISE EXCEPTION 'tenant_id mismatch: row tenant % does not match student tenant', NEW.tenant_id;
    END IF;
  END IF;
  IF NEW.category_id IS NOT NULL THEN
    IF NEW.tenant_id <> (SELECT tenant_id FROM categories WHERE id = NEW.category_id) THEN
      RAISE EXCEPTION 'tenant_id mismatch: row tenant % does not match category tenant', NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_tenant_consistency ON attendance;
CREATE TRIGGER trg_attendance_tenant_consistency
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_consistency();

DROP TRIGGER IF EXISTS trg_rankings_tenant_consistency ON category_rankings;
CREATE TRIGGER trg_rankings_tenant_consistency
  BEFORE INSERT OR UPDATE ON category_rankings
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_consistency();
