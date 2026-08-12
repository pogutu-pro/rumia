-- Agent application intake for multi-campus operations.
--
-- Hostel owners / prospective agents apply to run hostels on Rumia. A campus
-- manager reviews applications scoped to their own managed_campus_id.
-- Additive: brand-new table, no effect on existing DeKUT flows.

BEGIN;

-- ── Reusable campus-scoping helpers ────────────────────────────────────
-- Single source of truth for RLS authorization, to avoid policy sprawl as
-- roles/tables grow. `is_campus_super_admin` covers both admin and
-- super_admin so existing admins keep full access and super_admin inherits it.
CREATE OR REPLACE FUNCTION public.is_campus_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- True when the current user is a super_admin/admin (bypasses all campus
-- scoping) OR is a manager assigned to the given campus.
CREATE OR REPLACE FUNCTION public.is_manager_of_campus(p_campus_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_campus_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'manager'
        AND managed_campus_id = p_campus_id
    );
$$;

CREATE TABLE IF NOT EXISTS public.agent_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campus_id             UUID NOT NULL REFERENCES public.campuses(id),
  full_name             TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  id_number             TEXT NOT NULL,
  hostel_name           TEXT NOT NULL,
  relationship_to_hostel TEXT NOT NULL,
  owner_contact         TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_applications_campus   ON public.agent_applications (campus_id);
CREATE INDEX IF NOT EXISTS idx_agent_applications_user     ON public.agent_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_applications_status   ON public.agent_applications (status);

ALTER TABLE public.agent_applications ENABLE ROW LEVEL SECURITY;

-- ── Own-application access ──────────────────────────────────────────────
-- An authenticated student/owner can read their own application.
DROP POLICY IF EXISTS "agent_applications_select_own" ON public.agent_applications;
CREATE POLICY "agent_applications_select_own"
  ON public.agent_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- An authenticated user can submit an application for themselves.
DROP POLICY IF EXISTS "agent_applications_insert_own" ON public.agent_applications;
CREATE POLICY "agent_applications_insert_own"
  ON public.agent_applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agent_applications_update_own" ON public.agent_applications;
CREATE POLICY "agent_applications_update_own"
  ON public.agent_applications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Admin / SuperAdmin can manage any application ─────────────────────────
DROP POLICY IF EXISTS "agent_applications_select_admin" ON public.agent_applications;
CREATE POLICY "agent_applications_select_admin"
  ON public.agent_applications FOR SELECT
  TO authenticated
  USING (is_campus_super_admin());

DROP POLICY IF EXISTS "agent_applications_update_admin" ON public.agent_applications;
CREATE POLICY "agent_applications_update_admin"
  ON public.agent_applications FOR UPDATE
  TO authenticated
  USING (is_campus_super_admin())
  WITH CHECK (is_campus_super_admin());

COMMIT;