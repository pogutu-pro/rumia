-- Add property_type to listings.
-- Classifies every listing as one of the first-class Rumia property types:
--   'hostel'     -> long-stay student/tenant accommodation (monthly pricing)
--   'apartment'  -> self-contained apartments (usually monthly pricing)
--   'short_stay' -> nightly-priced short stays
-- Existing rows default to 'hostel' so nothing becomes invisible.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_type TEXT NOT NULL DEFAULT 'hostel';

-- Fast category feeds (Home Explore chips + home discovery sections).
CREATE INDEX IF NOT EXISTS idx_listings_property_type_is_active
  ON listings (property_type, is_active)
  WHERE is_active = true;

COMMENT ON COLUMN listings.property_type IS
  'First-class property classification: hostel, apartment, or short_stay.';