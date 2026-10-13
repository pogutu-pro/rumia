-- DOWN for 20260807000000_add_campuses.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts: campuses table + its public select policy.
BEGIN;

ALTER TABLE public.campuses DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campuses_select_public" ON public.campuses;
DROP TABLE IF EXISTS public.campuses;

COMMIT;