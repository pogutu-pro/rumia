-- Track explicit home-university confirmation + stop force-stamping DeKUT.
--
-- Why: the multi-university rollout means students come from many campuses, but
-- the backfill (20260807000002) auto-stamped campus_id AND home_campus_id to
-- DeKUT on every existing profile, and the trigger (20260809000001 era) kept
-- doing the same for new users. The app therefore cannot tell "the user chose
-- their university" from "the system assigned DeKUT", so the completion gate
-- never fires and nobody is ever asked.
--
-- Fix: add home_campus_confirmed_at, set ONLY when the user explicitly saves or
-- confirms their home university (completion modal / account settings). The app
-- gate now keys off this flag, so:
--   - existing users (auto-stamped DeKUT) are re-prompted exactly once to
--     confirm their real university, and
--   - new users are asked to choose instead of silently defaulting to DeKUT.
--
-- Backward-compatible: only ADD COLUMN + CREATE OR REPLACE the trigger.
-- No existing row is modified, no column is dropped, nothing is renamed.

BEGIN;

-- 1) Explicit confirmation timestamp (NULL = never confirmed by the user).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_campus_confirmed_at TIMESTAMPTZ;

-- 2) New users: no longer force home_campus_id to DeKUT. The legacy NOT NULL
--    campus_id is still populated (defensively: DeKUT if present, else the
--    first active campus) so the trigger never violates the constraint.
--    home_campus_id / home_campus_name / home_campus_confirmed_at stay NULL
--    until the student picks their university in the completion flow.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campus_id UUID;
BEGIN
  SELECT id INTO v_campus_id
    FROM public.campuses
   WHERE slug = 'dekut'
   LIMIT 1;

  IF v_campus_id IS NULL THEN
    SELECT id INTO v_campus_id
      FROM public.campuses
     WHERE status = 'active'
     ORDER BY name
     LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, campus_id, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE
      WHEN NEW.email ILIKE '%admin%' THEN 'admin'
      ELSE 'student'
    END,
    v_campus_id,
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
