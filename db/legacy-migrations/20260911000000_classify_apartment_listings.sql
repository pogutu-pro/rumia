-- Classify the existing apartment listings so the dynamic apartment feed has real records.
-- This is data correction only; the homepage continues to filter by listings.property_type.

UPDATE listings
SET property_type = 'apartment'
WHERE title ILIKE '%takimu%'
   OR title ILIKE '%urban suit%';
