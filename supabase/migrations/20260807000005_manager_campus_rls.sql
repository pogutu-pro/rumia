-- Manager campus-scoped RLS for agents + agent applications.
--
-- A campus manager can read/write agents and agent applications only where
-- campus_id = their managed_campus_id. Super_admin/admin bypass campus scoping
-- entirely (via is_campus_super_admin inside is_manager_of_campus).
--
-- Uses the reusable helpers from 20260807000004_add_agent_applications.
-- Additive: new policies only. No existing DeKUT agent/listing policy is
-- changed or removed, so current behaviour is untouched.

BEGIN;

-- ── Agents ────────────────────────────────────────────────────────────
-- Public SELECT already exists (agents_select_public, USING true), so a
-- separate manager SELECT policy is unnecessary. Manager write-scoping:
DROP POLICY IF EXISTS "agents_insert_manager" ON public.agents;
CREATE POLICY "agents_insert_manager"
  ON public.agents FOR INSERT
  TO authenticated
  WITH CHECK (
    is_manager_of_campus(agents.campus_id)
  );

DROP POLICY IF EXISTS "agents_update_manager" ON public.agents;
CREATE POLICY "agents_update_manager"
  ON public.agents FOR UPDATE
  TO authenticated
  USING (is_manager_of_campus(agents.campus_id))
  WITH CHECK (is_manager_of_campus(agents.campus_id));

DROP POLICY IF EXISTS "agents_delete_manager" ON public.agents;
CREATE POLICY "agents_delete_manager"
  ON public.agents FOR DELETE
  TO authenticated
  USING (is_manager_of_campus(agents.campus_id));

-- ── Agent applications ────────────────────────────────────────────────
DROP POLICY IF EXISTS "agent_applications_select_manager" ON public.agent_applications;
CREATE POLICY "agent_applications_select_manager"
  ON public.agent_applications FOR SELECT
  TO authenticated
  USING (is_manager_of_campus(agent_applications.campus_id));

DROP POLICY IF EXISTS "agent_applications_insert_manager" ON public.agent_applications;
CREATE POLICY "agent_applications_insert_manager"
  ON public.agent_applications FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_of_campus(agent_applications.campus_id));

DROP POLICY IF EXISTS "agent_applications_delete_manager" ON public.agent_applications;
CREATE POLICY "agent_applications_delete_manager"
  ON public.agent_applications FOR DELETE
  TO authenticated
  USING (is_manager_of_campus(agent_applications.campus_id));

-- Managers can also update applications for their campus (approve/reject).
DROP POLICY IF EXISTS "agent_applications_update_manager" ON public.agent_applications;
CREATE POLICY "agent_applications_update_manager"
  ON public.agent_applications FOR UPDATE
  TO authenticated
  USING (is_manager_of_campus(agent_applications.campus_id))
  WITH CHECK (is_manager_of_campus(agent_applications.campus_id));

-- ── Function privileges ───────────────────────────────────────────────
-- RLS policies are evaluated in the invoking role's context; authenticated
-- users must be able to EXECUTE the helper functions for the policies to work.
GRANT EXECUTE ON FUNCTION public.is_campus_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_of_campus(UUID) TO authenticated;

COMMIT;