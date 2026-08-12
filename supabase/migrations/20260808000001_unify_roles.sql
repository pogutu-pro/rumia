-- Unify the role model to exactly four roles (Part B consistency fix).
--
-- The prior Phase 4B work introduced a redundant `super_admin` role that
-- duplicated `admin` ("/admin is the super admin"). This migration collapses
-- the model to: student, agent, manager, admin.
--
--   • Any legacy `super_admin` profile becomes `admin` (none exist today; the
--     guard keeps this correct if re-run later).
--   • The profiles CHECK constraint is tightened to the 4 canonical roles.
--   • is_campus_super_admin() now treats `admin` as the single top role, so
--     RLS / manager scoping behaves consistently for the one true admin.
--
-- Additive + idempotent.
-- Rollback: supabase/migrations/_rollback/20260808000001_unify_roles.down.sql

BEGIN;

-- ── 1. Collapse legacy super_admin rows into admin ───────────────────────
UPDATE public.profiles
   SET role = 'admin'
 WHERE role = 'super_admin';

-- ── 2. Tighten the role CHECK to exactly four roles ──────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'agent', 'manager', 'admin'));

-- ── 3. admin is the single top role ──────────────────────────────────────
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
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_campus_super_admin() TO authenticated;

COMMIT;