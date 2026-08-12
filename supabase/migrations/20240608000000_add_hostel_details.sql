-- Add new hostel listing detail columns
-- These support the renovated listing form with improved location, pricing, and payment handling

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS specific_location TEXT,
  ADD COLUMN IF NOT EXISTS price_single INTEGER,
  ADD COLUMN IF NOT EXISTS price_sharing INTEGER,
  ADD COLUMN IF NOT EXISTS mpesa_details TEXT,
  ADD COLUMN IF NOT EXISTS distance_category TEXT;

-- Add constraint to ensure at least one price is provided (this will be checked at application level)
-- Add constraint to area values if needed (optional, can be handled at application level)

-- Create index on area for filtering
CREATE INDEX IF NOT EXISTS listings_area_idx ON listings(area);

-- Create index on distance_category for badge display
CREATE INDEX IF NOT EXISTS listings_distance_category_idx ON listings(distance_category);
