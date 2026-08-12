-- Add structured search fields to listings

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'mixed'
    CHECK (gender IN ('male', 'female', 'mixed')),
  ADD COLUMN IF NOT EXISTS proximity_description TEXT DEFAULT '',
  -- room_type already exists as free-text; add a normalised enum column
  ADD COLUMN IF NOT EXISTS room_type_enum TEXT
    CHECK (room_type_enum IN ('self_contained', 'bedsitter', 'single', 'double', 'shared'));

-- Full-text search index on title, description, location
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(title, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(location, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS listings_fts_idx ON listings USING GIN (fts);

-- Index commonly filtered columns
CREATE INDEX IF NOT EXISTS listings_gender_idx ON listings (gender);
CREATE INDEX IF NOT EXISTS listings_room_type_enum_idx ON listings (room_type_enum);
CREATE INDEX IF NOT EXISTS listings_price_idx ON listings (price);
