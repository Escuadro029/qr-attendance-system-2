-- Adds the principal's e-signature (base64 data URI, like the certificate
-- template's uploaded logo images) to certificate_settings, so it can be
-- uploaded once and automatically included on every certificate type.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this column from the start.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_settings' AND column_name = 'signatory_signature'
  ) THEN
    ALTER TABLE certificate_settings ADD COLUMN signatory_signature TEXT;
  END IF;
END $$;
