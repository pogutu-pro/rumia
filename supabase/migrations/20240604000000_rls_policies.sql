-- ─────────────────────────────────────────────────────────────
-- RLS Policies for Rumia
-- Service role key bypasses all of these (admin actions are safe)
-- Authenticated users = agents using the dashboard
-- Anon users = public browsing the marketplace
-- ─────────────────────────────────────────────────────────────

-- AGENTS
-- Anyone can read agents (needed for public listing pages showing agent name)
DROP POLICY IF EXISTS "agents_select_public" ON agents;
CREATE POLICY "agents_select_public"
  ON agents FOR SELECT
  USING (true);

-- Authenticated users can insert their own agent profile
DROP POLICY IF EXISTS "agents_insert_own" ON agents;
CREATE POLICY "agents_insert_own"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Agents can update their own profile only
DROP POLICY IF EXISTS "agents_update_own" ON agents;
CREATE POLICY "agents_update_own"
  ON agents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────

-- LISTINGS
-- Public can read active listings
DROP POLICY IF EXISTS "listings_select_active_public" ON listings;
CREATE POLICY "listings_select_active_public"
  ON listings FOR SELECT
  USING (is_active = true);

-- Agents can also read their own inactive listings
DROP POLICY IF EXISTS "listings_select_own_agent" ON listings;
CREATE POLICY "listings_select_own_agent"
  ON listings FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Agents can insert listings for themselves only
DROP POLICY IF EXISTS "listings_insert_own" ON listings;
CREATE POLICY "listings_insert_own"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Agents can update their own listings
DROP POLICY IF EXISTS "listings_update_own" ON listings;
CREATE POLICY "listings_update_own"
  ON listings FOR UPDATE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Agents can delete their own listings
DROP POLICY IF EXISTS "listings_delete_own" ON listings;
CREATE POLICY "listings_delete_own"
  ON listings FOR DELETE
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────

-- LISTING IMAGES
-- Public can read images for active listings
DROP POLICY IF EXISTS "listing_images_select_public" ON listing_images;
CREATE POLICY "listing_images_select_public"
  ON listing_images FOR SELECT
  USING (true);

-- Agents can insert images for their own listings
DROP POLICY IF EXISTS "listing_images_insert_own" ON listing_images;
CREATE POLICY "listing_images_insert_own"
  ON listing_images FOR INSERT
  TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN agents a ON l.agent_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- Agents can delete images from their own listings
DROP POLICY IF EXISTS "listing_images_delete_own" ON listing_images;
CREATE POLICY "listing_images_delete_own"
  ON listing_images FOR DELETE
  TO authenticated
  USING (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN agents a ON l.agent_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────

-- LISTING ROOM TYPES
DROP POLICY IF EXISTS "listing_room_types_select_public" ON listing_room_types;
CREATE POLICY "listing_room_types_select_public"
  ON listing_room_types FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "listing_room_types_insert_own" ON listing_room_types;
CREATE POLICY "listing_room_types_insert_own"
  ON listing_room_types FOR INSERT
  TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN agents a ON l.agent_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "listing_room_types_update_own" ON listing_room_types;
CREATE POLICY "listing_room_types_update_own"
  ON listing_room_types FOR UPDATE
  TO authenticated
  USING (
    listing_id IN (
      SELECT l.id FROM listings l
      JOIN agents a ON l.agent_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────

-- LEADS
-- Agents can read their own leads
DROP POLICY IF EXISTS "leads_select_own" ON leads;
CREATE POLICY "leads_select_own"
  ON leads FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Anyone (including anon) can insert a lead — this is the WhatsApp click tracking
DROP POLICY IF EXISTS "leads_insert_public" ON leads;
CREATE POLICY "leads_insert_public"
  ON leads FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────

-- COMMISSIONS
-- Agents can read their own commissions
DROP POLICY IF EXISTS "commissions_select_own" ON commissions;
CREATE POLICY "commissions_select_own"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Only service role (admin) can insert/update commissions — no client policy needed
-- The track-lead API route uses createClient() (anon key) so we need insert for that
DROP POLICY IF EXISTS "commissions_insert_service" ON commissions;
CREATE POLICY "commissions_insert_service"
  ON commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "commissions_update_service" ON commissions;
CREATE POLICY "commissions_update_service"
  ON commissions FOR UPDATE
  TO authenticated
  USING (true);
