-- Adds a page orientation setting (portrait/landscape) per certificate
-- template, independent of the elements array.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this column from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_templates' AND column_name = 'orientation'
  ) THEN
    RAISE NOTICE 'certificate_templates.orientation already present -- skipping.';
    RETURN;
  END IF;

  ALTER TABLE certificate_templates
    ADD COLUMN orientation VARCHAR(20) NOT NULL DEFAULT 'portrait';
END $$;
