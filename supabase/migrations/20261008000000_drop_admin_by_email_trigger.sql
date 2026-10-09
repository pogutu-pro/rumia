-- Security: an earlier migration created a trigger on auth.users that gave the 'admin' role to any new
-- account whose email contained "admin". Production never had it (verified 2026-10-05), but a database
-- rebuilt from these migrations did. Profiles are created by the application on first sign-in, with the
-- default role, so the trigger is not needed. Safe to run where it does not exist.
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_profile() CASCADE;
