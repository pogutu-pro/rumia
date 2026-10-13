-- Add a freeform home_campus_name to profiles for suggested or typed campus names
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_campus_name text;

COMMIT;
