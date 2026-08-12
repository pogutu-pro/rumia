-- Backfill campus_id on every existing DeKUT row + set home_campus_id on profiles.
--
-- Every existing listing / agent / profile unambiguously belongs to the single
-- live DeKUT campus, so the backfill is clean (no ambiguous rows expected).
-- This runs BEFORE the NOT NULL migration so the whole column set flips together.
-- Also updates the new-user trigger so future profiles default to the DeKUT campus.

BEGIN;

-- Resolve the DeKUT campus id once.
-- Single-campus today, so a single target is safe.
-- Each backfill runs only over rows that still have NULL, so the migration is
-- idempotent and safe to re-run.

UPDATE public.listings  l
   SET campus_id = c.id
FROM public.campuses c
WHERE c.slug = 'dekut'
  AND l.campus_id IS NULL;

UPDATE public.agents a
SET campus_id = (SELECT id FROM public.campuses WHERE slug = 'dekut')
WHERE a.campus_id IS NULL;

-- profiles.campus_id and home_campus_id are handled independently so a row
-- that already has one value but not the other is still corrected.
UPDATE public.profiles p
SET campus_id = (SELECT id FROM public.campuses WHERE slug = 'dekut')
WHERE p.campus_id IS NULL;

UPDATE public.profiles p
SET home_campus_id = (SELECT id FROM public.campuses WHERE slug = 'dekut')
WHERE p.home_campus_id IS NULL;

-- (managers have no managed_campus_id yet, so nothing to backfill there.)

DO $$
DECLARE
  v_listings BIGINT;
  v_agents   BIGINT;
  v_profiles BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_listings FROM public.listings WHERE campus_id IS NOT NULL;
  SELECT COUNT(*) INTO v_agents   FROM public.agents   WHERE campus_id IS NOT NULL;
  SELECT COUNT(*) INTO v_profiles FROM public.profiles WHERE campus_id IS NOT NULL;
  RAISE NOTICE 'Backfill complete: listings.campus_id=%, agents.campus_id=%, profiles.campus_id=%',
    v_listings, v_agents, v_profiles;
END $$;

-- ── Update new-profile trigger to stamp campus for new users ──────────────
-- Preserves the exact behaviour from remove_hardcoded_admin_emails_from_trigger
-- but also assigns home_campus_id (and campus_id default) to the DeKUT campus.
-- Only drops & recreates the trigger/function; no other trigger changes.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, campus_id, home_campus_id, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE
      WHEN NEW.email ILIKE '%admin%' THEN 'admin'
      ELSE 'student'
    END,
    (SELECT id FROM public.campuses WHERE slug = 'dekut'),
    (SELECT id FROM public.campuses WHERE slug = 'dekut'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMIT;