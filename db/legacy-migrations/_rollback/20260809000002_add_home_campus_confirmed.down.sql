-- Rollback 20260809000002_add_home_campus_confirmed.sql
BEGIN;

-- Restore the DeKUT-stamping trigger (as defined by 20260807000002_backfill_campus).
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

-- Drop the confirmation column (existing rows lose the flag; campus data is kept).
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS home_campus_confirmed_at;

COMMIT;
