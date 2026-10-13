-- Add admin SELECT-all policy for listings.
-- The existing public/agent policies only expose active or own listings,
-- so admins (anon-key client) could not see inactive listings from other
-- agents on the admin Hostels / official-hostels view.

DROP POLICY IF EXISTS "listings_select_admin" ON listings;
CREATE POLICY "listings_select_admin"
  ON listings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );