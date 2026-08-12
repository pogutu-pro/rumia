DROP POLICY IF EXISTS "listing_room_types_delete_own" ON listing_room_types;
CREATE POLICY "listing_room_types_delete_own"
  ON listing_room_types FOR DELETE
  TO authenticated
  USING (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN agents a ON l.agent_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );
