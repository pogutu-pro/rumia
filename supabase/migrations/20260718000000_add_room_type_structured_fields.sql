-- Add structured fields to listing_room_types for room type restructure
-- All columns are nullable to preserve backward compatibility with existing listings

ALTER TABLE listing_room_types
  ADD COLUMN IF NOT EXISTS deposit INTEGER,
  ADD COLUMN IF NOT EXISTS furnishing_items TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS occupancy TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT;
