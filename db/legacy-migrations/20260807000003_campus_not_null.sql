-- Constrain campus_id to NOT NULL now that the backfill is complete.
--
-- Runs a guard first: if any row still has a NULL campus_id, the migration
-- aborts loudly instead of silently adding a constraint that breaks inserts.
-- Only campus_id becomes NOT NULL; home_campus_id / managed_campus_id stay
-- nullable (a new user or a manager may legitimately have no campus yet).

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.listings WHERE campus_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot set NOT NULL: listings.campus_id has NULL rows (backfill incomplete)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.agents WHERE campus_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot set NOT NULL: agents.campus_id has NULL rows (backfill incomplete)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE campus_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot set NOT NULL: profiles.campus_id has NULL rows (backfill incomplete)';
  END IF;
END $$;

ALTER TABLE public.listings
  ALTER COLUMN campus_id SET NOT NULL;

ALTER TABLE public.agents
  ALTER COLUMN campus_id SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN campus_id SET NOT NULL;

COMMIT;