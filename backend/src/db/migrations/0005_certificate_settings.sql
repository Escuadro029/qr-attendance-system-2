-- A single settings row per tenant holding the certificate "constants" that
-- rarely change (office/division name, signatory, current event date range
-- and venue) — previously only settable via ad-hoc query-string parameters
-- or by hand-editing text directly into a template's text boxes.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this table from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'certificate_settings'
  ) THEN
    RAISE NOTICE 'certificate_settings already present -- skipping.';
    RETURN;
  END IF;

  CREATE TABLE certificate_settings (
    tenant_id       UUID PRIMARY KEY REFERENCES tenants(id),
    office_line     VARCHAR(200),
    signatory_name  VARCHAR(150),
    signatory_title VARCHAR(150),
    date_range      VARCHAR(200),
    venue           VARCHAR(200),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
END $$;
