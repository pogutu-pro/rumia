-- Normalize existing listing slugs that still contain raw area text with spaces.
-- The old generateListingSlug() did not slugify the area parameter,
-- so slugs like "grace-hostels-Near Gate A" were stored instead of
-- "grace-hostels-near-gate-a". This migration fixes those slugs inline,
-- without breaking the unique constraint, by first removing the constraint,
-- updating, then re-adding it.

-- Step 1: Drop the unique index so we can update slugs without conflict
DROP INDEX IF EXISTS listings_slug_unique;

-- Step 2: Normalize slugs — lowercase, replace spaces with hyphens, collapse multiple hyphens
UPDATE listings
SET slug = regexp_replace(
    regexp_replace(lower(trim(slug)), '\s+', '-', 'g'),
    '-+', '-', 'g'
  )
WHERE slug IS NOT NULL
  AND slug ~ '\s';

-- Step 3: Resolve any remaining collisions by appending -2, -3 etc.
-- (uses a PL/pgSQL block to handle conflicts)
DO $$
DECLARE
  rec RECORD;
  new_slug TEXT;
  counter INT;
BEGIN
  FOR rec IN
    SELECT id, slug
    FROM (
      SELECT id, slug,
        ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS rn
      FROM listings
      WHERE slug IS NOT NULL
    ) dup
    WHERE dup.rn > 1
    ORDER BY id
  LOOP
    counter := 2;
    LOOP
      new_slug := rec.slug || '-' || counter;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM listings WHERE slug = new_slug);
      counter := counter + 1;
    END LOOP;
    UPDATE listings SET slug = new_slug WHERE id = rec.id;
  END LOOP;
END $$;

-- Step 4: Re-create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS listings_slug_unique ON listings (slug) WHERE slug IS NOT NULL;

-- Step 5: Also fix agent slugs the same way (though less likely affected)
UPDATE agents
SET slug = regexp_replace(
    regexp_replace(lower(trim(slug)), '\s+', '-', 'g'),
    '-+', '-', 'g'
  )
WHERE slug IS NOT NULL
  AND slug ~ '\s';
