-- DOWN for 20260807000001_add_campus_columns.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts: campus columns + index + role check back to ('student','agent','admin').
-- NOTE: run this only after dropping the dependent policies/functions from
-- 20260807000005_add_agent_applications and 20260807000006_manager_campus_rls.
BEGIN;

DROP INDEX IF EXISTS idx_profiles_managed_campus_id;
DROP INDEX IF EXISTS idx_profiles_home_campus_id;
DROP INDEX IF EXISTS idx_profiles_campus_id;
DROP INDEX IF EXISTS idx_agents_campus_id;
DROP INDEX IF EXISTS idx_listings_campus_id;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS managed_campus_id,
  DROP COLUMN IF EXISTS home_campus_id,
  DROP COLUMN IF EXISTS campus_id;

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS campus_id;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS campus_id;

-- Restore original role check
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'agent', 'admin'));

COMMIT;