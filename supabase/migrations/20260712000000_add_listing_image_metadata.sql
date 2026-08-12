-- Add image metadata columns to listing_images for blur placeholders and responsive sizing
ALTER TABLE listing_images
  ADD COLUMN IF NOT EXISTS blur_data_url TEXT,
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS format TEXT;
