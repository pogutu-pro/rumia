-- The listings feed loads images with `WHERE listing_id IN (...) ORDER BY display_order`.
-- Postgres does not index foreign keys, and the model's index=True never reaches a DB built from
-- SQL migrations, so this ran as a seq scan (1.5-1.9s in Sentry "Slow DB Query").
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id_display_order
  ON listing_images (listing_id, display_order);
