-- Hostel Requests: "Find Me a Hostel" — students request a hostel search and
-- a manager picks it up from the Manager Dashboard, then contacts them on
-- WhatsApp. Also adds an in-app notification table so managers are alerted
-- when a new request lands.
--
-- Additive: brand-new tables only. No existing table or policy is changed.

BEGIN;

-- ── Hostel requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hostel_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  campus_id UUID NOT NULL REFERENCES public.campuses(id),
  preferred_zone TEXT,
  budget_range TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'no_preference'
    CHECK (gender IN ('male', 'female', 'no_preference')),
  room_type TEXT NOT NULL DEFAULT 'no_preference'
    CHECK (room_type IN ('single', 'shared', 'bedsitter', 'no_preference')),
  furnishing TEXT NOT NULL DEFAULT 'no_preference'
    CHECK (furnishing IN ('furnished', 'unfurnished', 'no_preference')),
  move_in_date DATE,
  additional_requirements TEXT,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'contacted', 'finding', 'hostel_found', 'completed', 'cancelled')),
  fee NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hostel_requests_user   ON public.hostel_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_hostel_requests_campus ON public.hostel_requests (campus_id);
CREATE INDEX IF NOT EXISTS idx_hostel_requests_status ON public.hostel_requests (status);
CREATE INDEX IF NOT EXISTS idx_hostel_requests_created_at
  ON public.hostel_requests (created_at DESC);

ALTER TABLE public.hostel_requests ENABLE ROW LEVEL SECURITY;

-- A student can insert a request for themselves.
DROP POLICY IF EXISTS "hostel_requests_insert_own" ON public.hostel_requests;
CREATE POLICY "hostel_requests_insert_own"
  ON public.hostel_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- A student can read their own requests and see status updates from the account page.
DROP POLICY IF EXISTS "hostel_requests_select_own" ON public.hostel_requests;
CREATE POLICY "hostel_requests_select_own"
  ON public.hostel_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Students can cancel their own waiting/contacted requests.
DROP POLICY IF EXISTS "hostel_requests_update_own" ON public.hostel_requests;
CREATE POLICY "hostel_requests_update_own"
  ON public.hostel_requests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers + super admins can read requests for their campus.
DROP POLICY IF EXISTS "hostel_requests_select_manager" ON public.hostel_requests;
CREATE POLICY "hostel_requests_select_manager"
  ON public.hostel_requests FOR SELECT
  TO authenticated
  USING (public.is_manager_of_campus(campus_id));

-- Managers + super admins can update request status as the workflow progresses.
DROP POLICY IF EXISTS "hostel_requests_update_manager" ON public.hostel_requests;
CREATE POLICY "hostel_requests_update_manager"
  ON public.hostel_requests FOR UPDATE
  TO authenticated
  USING (public.is_manager_of_campus(campus_id))
  WITH CHECK (public.is_manager_of_campus(campus_id));

-- ── In-app notifications ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user
  ON public.app_notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications.
DROP POLICY IF EXISTS "app_notifications_select_own" ON public.app_notifications;
CREATE POLICY "app_notifications_select_own"
  ON public.app_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read.
DROP POLICY IF EXISTS "app_notifications_update_own" ON public.app_notifications;
CREATE POLICY "app_notifications_update_own"
  ON public.app_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserts are performed server-side with the service role.
DROP POLICY IF EXISTS "app_notifications_service_all" ON public.app_notifications;
CREATE POLICY "app_notifications_service_all"
  ON public.app_notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT EXECUTE ON FUNCTION public.is_manager_of_campus(UUID) TO authenticated;

COMMIT;