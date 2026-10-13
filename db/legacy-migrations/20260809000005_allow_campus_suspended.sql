-- Allow campuses to be suspended
-- The original campuses table only allowed ('active', 'coming_soon').
-- This migration adds 'suspended' so campus-level lockdowns are possible.

BEGIN;

-- Drop the old check constraint if it exists
ALTER TABLE public.campuses
  DROP CONSTRAINT IF EXISTS campuses_status_check;

-- Recreate with suspended included
ALTER TABLE public.campuses
  ADD CONSTRAINT campuses_status_check
  CHECK (status IN ('active', 'coming_soon', 'suspended'));

COMMIT;
