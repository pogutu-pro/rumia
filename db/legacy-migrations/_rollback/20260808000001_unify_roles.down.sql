-- DOWN for 20260808000001_unify_roles.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'agent', 'admin', 'manager', 'super_admin'));

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

GRANT EXECUTE ON FUNCTION public.is_campus_super_admin() TO authenticated;

COMMIT;