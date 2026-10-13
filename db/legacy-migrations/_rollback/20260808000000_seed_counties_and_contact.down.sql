-- DOWN for 20260808000000_seed_counties_and_contact.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
--
-- Reverts the corrected region model: removes the contact columns, undoes the
-- campus.region_id backfill, deletes the 47 seeded counties, and re-opens
-- regions RLS (restore a super_admin-all policy so a future release can still
-- read them). Only meaningful if the up-migration is reverted in the same
-- release window - delete on regions is a destructive, manual action.
BEGIN;

ALTER TABLE public.campuses
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS social_links;

UPDATE public.campuses SET region_id = NULL;

-- Restore the pre-fix is_manager_of_campus (campus-scope only).
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

DELETE FROM public.regions;

DROP POLICY IF EXISTS "Enable read access for all users on regions" ON public.regions;
DROP POLICY IF EXISTS "regions_block_writes" ON public.regions;

CREATE POLICY "Enable full access for super_admin on regions"
  ON public.regions FOR ALL
  USING (public.is_campus_super_admin())
  WITH CHECK (public.is_campus_super_admin());

COMMIT;