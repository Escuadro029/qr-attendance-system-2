-- Adds a paper_size choice (A4 / Short-Letter / Long-PH-bond) per saved
-- certificate template, alongside the existing orientation column.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created this column from the start.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_templates' AND column_name = 'paper_size'
  ) THEN
    ALTER TABLE certificate_templates ADD COLUMN paper_size VARCHAR(20) NOT NULL DEFAULT 'short';
  END IF;
END $$;
