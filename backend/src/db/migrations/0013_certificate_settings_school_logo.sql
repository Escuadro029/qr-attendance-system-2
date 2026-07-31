-- Adds a school logo (Cloudinary URL, like the principal's e-signature) to
-- certificate_settings, so it can be uploaded once and automatically
-- replace the "Official Seal" circle on every certificate type.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this column from the start.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_settings' AND column_name = 'school_logo'
  ) THEN
    ALTER TABLE certificate_settings ADD COLUMN school_logo TEXT;
  END IF;
END $$;
