CREATE INDEX IF NOT EXISTS idx_listings_youtube_id_not_null
  ON listings (youtube_id)
  WHERE youtube_id IS NOT NULL;
