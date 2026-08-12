-- Clean up any negative or zero price values that may have been stored erroneously
UPDATE listings
SET
  price_sharing = NULL
WHERE price_sharing IS NOT NULL AND price_sharing <= 0;

UPDATE listings
SET
  price_single = NULL
WHERE price_single IS NOT NULL AND price_single <= 0;
