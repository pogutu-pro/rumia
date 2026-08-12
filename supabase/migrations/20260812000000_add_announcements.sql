-- Campus announcements for the Manager Dashboard.
--
-- Managers publish important updates that are surfaced prominently on Rumia's
-- public pages (/hostels and the landing page). Announcements are campus-scoped
-- and expire automatically: public SELECT is restricted to rows where
-- expires_at is still in the future, so expired announcements stop being
-- fetched/rendered by public pages without a manager having to delete them.
--
-- Additive: brand-new table + RLS policies. Reuses the existing
-- is_campus_super_admin() / is_manager_of_campus() helpers and the
-- set_updated_at() trigger helper, so nothing existing is changed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id  UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info'
             CHECK (type IN ('info', 'warning', 'encouragement')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Public pages query: WHERE campus_id = ? AND expires_at > now().
CREATE INDEX IF NOT EXISTS idx_announcements_campus_active
  ON public.announcements (campus_id, expires_at DESC);

-- Manager dashboard queries and audit/history lookups.
CREATE INDEX IF NOT EXISTS idx_announcements_created_by
  ON public.announcements (created_by);

CREATE INDEX IF NOT EXISTS idx_announcements_expires_at
  ON public.announcements (expires_at);

CREATE OR REPLACE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ── Public read (anon + authenticated) ─────────────────────────────────
-- Only unexpired announcements are ever readable by the public. Expiration is
-- enforced by the database so public pages never fetch/see stale rows.
DROP POLICY IF EXISTS "announcements_select_public" ON public.announcements;
CREATE POLICY "announcements_select_public"
  ON public.announcements FOR SELECT
  USING (expires_at > now());

-- ── Manager scoped access ───────────────────────────────────────────────
-- Managers can see all of their campus's announcements (active + expired) so
-- the dashboard can show history and clearly mark expired items. Super
-- admins/admin bypass campus scoping via is_manager_of_campus.
DROP POLICY IF EXISTS "announcements_select_manager" ON public.announcements;
CREATE POLICY "announcements_select_manager"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (is_manager_of_campus(announcements.campus_id));

DROP POLICY IF EXISTS "announcements_insert_manager" ON public.announcements;
CREATE POLICY "announcements_insert_manager"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_of_campus(announcements.campus_id));

DROP POLICY IF EXISTS "announcements_update_manager" ON public.announcements;
CREATE POLICY "announcements_update_manager"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (is_manager_of_campus(announcements.campus_id))
  WITH CHECK (is_manager_of_campus(announcements.campus_id));

DROP POLICY IF EXISTS "announcements_delete_manager" ON public.announcements;
CREATE POLICY "announcements_delete_manager"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (is_manager_of_campus(announcements.campus_id));

COMMIT;
