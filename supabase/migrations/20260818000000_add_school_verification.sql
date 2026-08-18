-- Add school verification columns to profiles.
-- school_verified is derived from the Google OAuth email on each login.
-- school_email stores the DeKUT email used for verification (for display/audit).

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS school_email TEXT;

-- Backfill existing users whose email ends with @dkut.ac.ke
UPDATE public.profiles
   SET school_verified = true,
       school_email = email
 WHERE email ILIKE '%@dkut.ac.ke'
   AND school_verified = false;

COMMIT;
