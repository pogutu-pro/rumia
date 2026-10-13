-- DOWN for 20260807000005_manager_campus_rls.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts: manager-scoped policies. Helper functions remain (dropped by
-- 20260807000004 down). Revokes function EXECUTE grants added here.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.is_manager_of_campus(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_campus_super_admin() FROM authenticated;

DROP POLICY IF EXISTS "agent_applications_update_manager" ON public.agent_applications;
DROP POLICY IF EXISTS "agent_applications_delete_manager" ON public.agent_applications;
DROP POLICY IF EXISTS "agent_applications_insert_manager" ON public.agent_applications;
DROP POLICY IF EXISTS "agent_applications_select_manager" ON public.agent_applications;

DROP POLICY IF EXISTS "agents_delete_manager" ON public.agents;
DROP POLICY IF EXISTS "agents_update_manager"  ON public.agents;
DROP POLICY IF EXISTS "agents_insert_manager"  ON public.agents;

COMMIT;