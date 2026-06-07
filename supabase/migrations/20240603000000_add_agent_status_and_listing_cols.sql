-- Add status column to agents (for active/suspended)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended'));

-- Add remaining listing columns used by the create-listing form and seed
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bathroom_type TEXT DEFAULT 'Shared',
  ADD COLUMN IF NOT EXISTS distance_to_campus TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS security_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS electricity_included BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS water_included BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wifi_included BOOLEAN DEFAULT false;

-- Add listing_room_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS listing_room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add paid_at to commissions
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
