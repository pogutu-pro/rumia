-- Add dedicated boolean columns for hot water and cooking gas
-- instead of storing them in the amenities text array
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS hot_water_included BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cooking_gas_included BOOLEAN DEFAULT false;

-- Backfill from corrupted amenities array data
UPDATE listings
SET hot_water_included = true
WHERE hot_water_included IS DISTINCT FROM true
  AND amenities @> ARRAY['Hot Water'];

UPDATE listings
SET cooking_gas_included = true
WHERE cooking_gas_included IS DISTINCT FROM true
  AND amenities @> ARRAY['Cooking Gas'];

-- Now clean Hot Water and Cooking Gas out of the amenities array permanently
UPDATE listings
SET amenities = array_remove(amenities, 'Hot Water')
WHERE amenities @> ARRAY['Hot Water'];

UPDATE listings
SET amenities = array_remove(amenities, 'Cooking Gas')
WHERE amenities @> ARRAY['Cooking Gas'];

-- Clean up empty amenities arrays to NULL for consistency
UPDATE listings
SET amenities = NULL
WHERE amenities = '{}'::text[]
   OR amenities IS NOT NULL AND array_length(amenities, 1) = 0;
