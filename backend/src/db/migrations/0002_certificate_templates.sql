-- Adds the certificate_templates table so certificate wording (title, body
-- paragraph, given-line, signatory) can be edited per tenant instead of
-- being hardcoded in certificateGenerator.js.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this table from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'certificate_templates'
  ) THEN
    RAISE NOTICE 'certificate_templates already present -- skipping.';
    RETURN;
  END IF;

  CREATE TABLE certificate_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    template_key    VARCHAR(20) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    office_line     VARCHAR(200) NOT NULL,
    body_text       TEXT NOT NULL,
    given_line      VARCHAR(300) NOT NULL,
    signatory_name  VARCHAR(150) NOT NULL,
    signatory_title VARCHAR(150) NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, template_key)
  );

  CREATE INDEX idx_certificate_templates_tenant ON certificate_templates(tenant_id);
END $$;
