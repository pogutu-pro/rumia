-- Add user_id to agents so Supabase Auth users map to agent profiles
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add missing listing columns used by the dashboard form
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS landlord_phone TEXT,
  ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'Single',
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7) DEFAULT -0.3975,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7) DEFAULT 36.9615;

-- Add image category column
ALTER TABLE listing_images
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Room';

-- Description column should be nullable (agents might leave it empty)
ALTER TABLE listings ALTER COLUMN description DROP NOT NULL;
