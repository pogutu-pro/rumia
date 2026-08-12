-- Tour Bookings: guest-friendly hostel tour scheduling

CREATE TABLE IF NOT EXISTS tour_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  zone TEXT NOT NULL,
  tour_type TEXT NOT NULL CHECK (tour_type IN ('specific_hostel', 'full_search')),
  amount NUMERIC NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'confirmed', 'paid', 'completed', 'no_show', 'cancelled')),
  linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_agent
  ON tour_bookings (agent_id, preferred_date ASC);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_status
  ON tour_bookings (status);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_phone
  ON tour_bookings (phone);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_linked_user
  ON tour_bookings (linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- RLS
ALTER TABLE tour_bookings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert a tour booking — this is the guest booking flow
DROP POLICY IF EXISTS "tour_bookings_insert_public" ON tour_bookings;
CREATE POLICY "tour_bookings_insert_public"
  ON tour_bookings FOR INSERT
  WITH CHECK (true);

-- Agents can read their own tour bookings
DROP POLICY IF EXISTS "tour_bookings_select_own" ON tour_bookings;
CREATE POLICY "tour_bookings_select_own"
  ON tour_bookings FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Agents can update their own tour bookings (status changes)
DROP POLICY IF EXISTS "tour_bookings_update_own" ON tour_bookings;
CREATE POLICY "tour_bookings_update_own"
  ON tour_bookings FOR UPDATE
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

-- Admin can read all tour bookings
DROP POLICY IF EXISTS "tour_bookings_select_admin" ON tour_bookings;
CREATE POLICY "tour_bookings_select_admin"
  ON tour_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update all tour bookings
DROP POLICY IF EXISTS "tour_bookings_update_admin" ON tour_bookings;
CREATE POLICY "tour_bookings_update_admin"
  ON tour_bookings FOR UPDATE
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

-- Authenticated users can read their own linked bookings (for tracking)
DROP POLICY IF EXISTS "tour_bookings_select_linked_user" ON tour_bookings;
CREATE POLICY "tour_bookings_select_linked_user"
  ON tour_bookings FOR SELECT
  TO authenticated
  USING (linked_user_id = auth.uid());

-- Authenticated users can update their own linked bookings (for linking)
DROP POLICY IF EXISTS "tour_bookings_update_linked_user" ON tour_bookings;
CREATE POLICY "tour_bookings_update_linked_user"
  ON tour_bookings FOR UPDATE
  TO authenticated
  USING (linked_user_id = auth.uid())
  WITH CHECK (linked_user_id = auth.uid());
