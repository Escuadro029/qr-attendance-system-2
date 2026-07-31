-- Adds a configurable event name (e.g. "School Press Conference") to
-- certificate_settings, so admins can set it once instead of it being a
-- hardcoded default / undocumented ?event= query param override.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this column from the start.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_settings' AND column_name = 'event_name'
  ) THEN
    ALTER TABLE certificate_settings ADD COLUMN event_name VARCHAR(200);
  END IF;
END $$;
