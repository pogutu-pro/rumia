-- DOWN for 20260807000002_backfill_campus.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts the backfill by nulling campus columns, and restores the pre-backfill
-- new-user trigger (hardcoded-admin-free variant from
-- 20260611070823_remove_hardcoded_admin_emails_from_trigger.sql).
-- NOTE: run only after 20260807000004_campus_not_null is already reverted
-- (columns must be nullable again first).
BEGIN;

UPDATE public.profiles SET home_campus_id = NULL, campus_id = NULL;
UPDATE public.agents     SET campus_id = NULL;
UPDATE public.listings   SET campus_id = NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE
      WHEN NEW.email ILIKE '%admin%' THEN 'admin'
      ELSE 'student'
    END,
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