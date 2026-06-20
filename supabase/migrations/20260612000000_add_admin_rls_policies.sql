-- Add RLS policies so admin users (via anon-key client) can manage all agents.
-- Previously only the service-role client could bypass RLS for admin actions.
-- This allows admin users authenticated with the anon-key client to also
-- insert, update, and delete agent records.

-- Admin can insert any agent
DROP POLICY IF EXISTS "agents_insert_admin" ON agents;
CREATE POLICY "agents_insert_admin"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update any agent
DROP POLICY IF EXISTS "agents_update_admin" ON agents;
CREATE POLICY "agents_update_admin"
  ON agents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can delete any agent
DROP POLICY IF EXISTS "agents_delete_admin" ON agents;
CREATE POLICY "agents_delete_admin"
  ON agents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can also manage listings (insert/update/delete any listing)
DROP POLICY IF EXISTS "listings_insert_admin" ON listings;
CREATE POLICY "listings_insert_admin"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "listings_update_admin" ON listings;
CREATE POLICY "listings_update_admin"
  ON listings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "listings_delete_admin" ON listings;
CREATE POLICY "listings_delete_admin"
  ON listings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
