-- DOWN for 20260807000004_add_agent_applications.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts: helper functions + agent_applications table & its policies.
-- NOTE: run BEFORE the manager policies from 20260807000005 are dropped.
BEGIN;

DROP POLICY IF EXISTS "agent_applications_select_admin" ON public.agent_applications;
DROP POLICY IF EXISTS "agent_applications_update_admin" ON public.agent_applications;
DROP POLICY IF EXISTS "agent_applications_update_own"   ON public.agent_applications;
DROP POLICY IF EXISTS "agent_applications_insert_own"   ON public.agent_applications;
DROP POLICY IF EXISTS "agent_applications_select_own"   ON public.agent_applications;

DROP TABLE IF EXISTS public.agent_applications;

DROP FUNCTION IF EXISTS public.is_manager_of_campus(UUID);
DROP FUNCTION IF EXISTS public.is_campus_super_admin();

COMMIT;