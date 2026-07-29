-- Guest speakers invited to the press conference, so they can be registered
-- and issued a Certificate of Recognition the same way students are.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this table from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_speakers'
  ) THEN
    RAISE NOTICE 'guest_speakers already present -- skipping.';
    RETURN;
  END IF;

  CREATE TABLE guest_speakers (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id),
    full_name    VARCHAR(150) NOT NULL,
    position     VARCHAR(150), -- e.g. "Senior Reporter"
    organization VARCHAR(200), -- e.g. "Philippine Daily Inquirer"
    topic        VARCHAR(200), -- what they spoke about
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_guest_speakers_tenant ON guest_speakers(tenant_id);
END $$;
