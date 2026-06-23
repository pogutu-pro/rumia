-- Create transfer_history table for auditing hostel ownership transfers
CREATE TABLE IF NOT EXISTS transfer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  previous_owner_id UUID NOT NULL REFERENCES agents(id),
  new_owner_id UUID NOT NULL REFERENCES agents(id),
  transferred_by UUID NOT NULL REFERENCES auth.users(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transfer_history ENABLE ROW LEVEL SECURITY;

-- Admins can read all transfers
DROP POLICY IF EXISTS "transfer_history_read_admin" ON transfer_history;
CREATE POLICY "transfer_history_read_admin"
  ON transfer_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can insert transfers
DROP POLICY IF EXISTS "transfer_history_insert_admin" ON transfer_history;
CREATE POLICY "transfer_history_insert_admin"
  ON transfer_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transfer_history_listing_id ON transfer_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_transferred_at ON transfer_history(transferred_at DESC);
