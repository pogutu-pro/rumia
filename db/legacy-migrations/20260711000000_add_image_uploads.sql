-- Image uploads metadata table
-- Stores metadata for every processed image uploaded to Cloudflare R2
CREATE TABLE IF NOT EXISTS image_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  format TEXT NOT NULL DEFAULT 'webp',
  thumbnail_key TEXT NOT NULL,
  small_key TEXT NOT NULL,
  medium_key TEXT NOT NULL,
  large_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow reading image uploads (used for display)
DROP POLICY IF EXISTS "image_uploads_select_public" ON image_uploads;
CREATE POLICY "image_uploads_select_public"
  ON image_uploads FOR SELECT
  USING (true);

-- Authenticated users can insert image uploads
DROP POLICY IF EXISTS "image_uploads_insert_authenticated" ON image_uploads;
CREATE POLICY "image_uploads_insert_authenticated"
  ON image_uploads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable RLS
ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;

-- Add image_upload_id FK to listing_images for the new pipeline
ALTER TABLE listing_images
  ADD COLUMN IF NOT EXISTS image_upload_id UUID REFERENCES image_uploads(id) ON DELETE SET NULL;
