-- Lets an admin add arbitrary extra name/value parameters (beyond the 5
-- built-in ones) that become available as {{placeholders}} in certificate
-- templates too — e.g. "Event Name" -> {{event_name}}.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this column from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_settings' AND column_name = 'custom_fields'
  ) THEN
    RAISE NOTICE 'certificate_settings.custom_fields already present -- skipping.';
    RETURN;
  END IF;

  ALTER TABLE certificate_settings
    ADD COLUMN custom_fields JSONB NOT NULL DEFAULT '[]';
END $$;
