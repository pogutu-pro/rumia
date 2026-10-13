-- DOWN for 20260818000000_add_school_verification.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts: profiles.school_verified + profiles.school_email.
BEGIN;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS school_email,
  DROP COLUMN IF EXISTS school_verified;

COMMIT;
