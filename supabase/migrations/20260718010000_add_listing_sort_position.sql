-- Add nullable sort_position to listings for admin-controlled ordering.
-- NULL means "use default ordering" (created_at DESC).
-- Non-NULL values pin listings to the top, sorted ascending.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS sort_position INTEGER DEFAULT NULL;

-- Index for efficient ordering: positioned listings first, then by created_at
CREATE INDEX IF NOT EXISTS idx_listings_sort_position
  ON listings (sort_position NULLS LAST, created_at DESC);

-- Audit table for listing sort position changes
CREATE TABLE IF NOT EXISTS listing_sort_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  old_position INTEGER,
  new_position INTEGER,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE listing_sort_history ENABLE ROW LEVEL SECURITY;

-- Admins can read all sort history
DROP POLICY IF EXISTS "listing_sort_history_read_admin" ON listing_sort_history;
CREATE POLICY "listing_sort_history_read_admin"
  ON listing_sort_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can insert sort history
DROP POLICY IF EXISTS "listing_sort_history_insert_admin" ON listing_sort_history;
CREATE POLICY "listing_sort_history_insert_admin"
  ON listing_sort_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_listing_sort_history_listing_id ON listing_sort_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_sort_history_changed_at ON listing_sort_history(changed_at DESC);
