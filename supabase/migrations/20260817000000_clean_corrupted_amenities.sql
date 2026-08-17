-- Remove utility names that were incorrectly merged into the amenities array
-- by the old form submission logic. These belong in dedicated boolean columns,
-- not in the amenities text array.
UPDATE listings
SET amenities = array_remove(amenities, 'Water')
WHERE amenities @> ARRAY['Water'];

UPDATE listings
SET amenities = array_remove(amenities, 'Electricity')
WHERE amenities @> ARRAY['Electricity'];

UPDATE listings
SET amenities = array_remove(amenities, 'WiFi')
WHERE amenities @> ARRAY['WiFi'];

UPDATE listings
SET amenities = array_remove(amenities, 'Security')
WHERE amenities @> ARRAY['Security'];

-- Backfill boolean columns from corrupted amenities data where booleans are NULL
-- but the utility name exists in amenities.
UPDATE listings
SET water_included = true
WHERE water_included IS DISTINCT FROM true
  AND amenities @> ARRAY['Water'];

UPDATE listings
SET electricity_included = true
WHERE electricity_included IS DISTINCT FROM true
  AND amenities @> ARRAY['Electricity'];

UPDATE listings
SET wifi_included = true
WHERE wifi_included IS DISTINCT FROM true
  AND amenities @> ARRAY['WiFi'];

-- Clean up empty amenities arrays to NULL for consistency
UPDATE listings
SET amenities = NULL
WHERE amenities = '{}'::text[]
   OR amenities IS NOT NULL AND array_length(amenities, 1) = 0;
