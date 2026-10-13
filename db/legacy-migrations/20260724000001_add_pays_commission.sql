-- Add commission control to listings
-- pays_commission: true = hostel pays agent commission (no user fee)
-- pays_commission: false = hostel does not pay, KES 50 consultation fee shown to user

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS pays_commission BOOLEAN NOT NULL DEFAULT true;

-- Admin can lock the commission setting so agents cannot override it
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS commission_locked_by_admin BOOLEAN NOT NULL DEFAULT false;

-- Allow agents to update commission status for their own listings
DROP POLICY IF EXISTS "listings_update_commission_own" ON listings;
CREATE POLICY "listings_update_commission_own"
  ON listings FOR UPDATE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );
