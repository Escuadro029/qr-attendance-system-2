-- Replaces the fixed-shape certificate_templates wording columns with a
-- generic, ordered list of positioned elements (text/shape/image), so
-- certificates can be freely re-laid-out (drag/resize) rather than only
-- edited within a fixed layout.
--
-- Guarded so this is a safe no-op against a fresh database where schema.sql
-- already created the `elements` shape from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certificate_templates' AND column_name = 'elements'
  ) THEN
    RAISE NOTICE 'certificate_templates.elements already present -- skipping.';
    RETURN;
  END IF;

  ALTER TABLE certificate_templates
    DROP COLUMN IF EXISTS title,
    DROP COLUMN IF EXISTS office_line,
    DROP COLUMN IF EXISTS body_text,
    DROP COLUMN IF EXISTS given_line,
    DROP COLUMN IF EXISTS signatory_name,
    DROP COLUMN IF EXISTS signatory_title,
    ADD COLUMN elements JSONB NOT NULL DEFAULT '[]';
END $$;
