-- Renames guest_speakers -> speakers as part of relabeling "Guest Speaker"
-- to "Speaker/Lecturer" throughout the product. Existing rows/data are kept.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created the `speakers` table under its new name from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'speakers'
  ) THEN
    RAISE NOTICE 'speakers already present -- skipping.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_speakers'
  ) THEN
    ALTER TABLE guest_speakers RENAME TO speakers;
    ALTER INDEX IF EXISTS idx_guest_speakers_tenant RENAME TO idx_speakers_tenant;
  ELSE
    CREATE TABLE speakers (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id    UUID NOT NULL REFERENCES tenants(id),
      full_name    VARCHAR(150) NOT NULL,
      position     VARCHAR(150),
      organization VARCHAR(200),
      topic        VARCHAR(200),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_speakers_tenant ON speakers(tenant_id);
  END IF;

  -- Any certificate template/layout an admin already saved for the old key
  -- carries over to the new one, so a renamed feature doesn't reset it.
  UPDATE certificate_templates SET template_key = 'speaker' WHERE template_key = 'guest_speaker';
END $$;
