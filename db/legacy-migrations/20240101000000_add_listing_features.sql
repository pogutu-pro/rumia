-- Add premium features to listings table
ALTER TABLE listings 
  ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bathroom_type TEXT DEFAULT 'Shared',
  ADD COLUMN IF NOT EXISTS distance_to_campus TEXT,
  ADD COLUMN IF NOT EXISTS security_type TEXT DEFAULT '24/7 Security',
  ADD COLUMN IF NOT EXISTS electricity_included BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS water_included BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wifi_included BOOLEAN DEFAULT false;

-- Create listing_room_types table to handle production-ready room pricing instead of a single price column
CREATE TABLE IF NOT EXISTS listing_room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL, -- e.g. 'Single', 'Double', 'Self Contained'
  price NUMERIC NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries on listing_id
CREATE INDEX IF NOT EXISTS idx_listing_room_types_listing_id ON listing_room_types(listing_id);

-- Optional: If the single price column on listings is deprecated, we could drop it later,
-- but for now we leave it for backwards compatibility.
