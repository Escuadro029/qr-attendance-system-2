-- Teachers who participated in running the press conference (facilitator,
-- judge, coordinator, reactor, etc.), so they can be registered and issued
-- their own exclusive Certificate of Appreciation.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this table from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'teachers'
  ) THEN
    RAISE NOTICE 'teachers already present -- skipping.';
    RETURN;
  END IF;

  CREATE TABLE teachers (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id),
    full_name    VARCHAR(150) NOT NULL,
    role         VARCHAR(150), -- e.g. "Facilitator", "Judge", "Coordinator"
    department   VARCHAR(200),
    topic        VARCHAR(200), -- session/topic they handled, if applicable
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_teachers_tenant ON teachers(tenant_id);
END $$;
