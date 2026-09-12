-- Covering index for the public listings feed count + pagination.
--
-- The feed runs two statements per request:
--   SELECT count(...) FROM listings [JOIN campuses ON campuses.id = listings.campus_id]
--     WHERE campus_id = $1 AND is_active = true [AND property_type = $2] ...
--   SELECT ... FROM listings ... ORDER BY sort_position NULLS LAST, created_at DESC LIMIT ...
--
-- With this index Postgres can satisfy the count with an index-only scan,
-- counting index tuples without ever reading the wide heap rows
-- (description, blur_data_url, amenities, ...) that previously made the
-- count ~190ms slow.

CREATE INDEX IF NOT EXISTS idx_listings_campus_active_type
  ON public.listings (campus_id, is_active, property_type);