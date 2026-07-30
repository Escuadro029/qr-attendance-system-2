-- Expands category_rankings.rank from 1st-3rd place only to 1st-10th place.
--
-- The original CHECK constraint was unnamed, so Postgres gave it its default
-- name (category_rankings_rank_check) — dropped and replaced with a wider
-- one. Guarded so this is a safe no-op against a fresh database where
-- schema.sql already created the wider constraint from the start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_rankings_rank_check'
  ) THEN
    ALTER TABLE category_rankings DROP CONSTRAINT category_rankings_rank_check;
    ALTER TABLE category_rankings ADD CONSTRAINT category_rankings_rank_check CHECK (rank BETWEEN 1 AND 10);
  END IF;
END $$;
