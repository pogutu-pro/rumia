-- Revert: drop stay_preference and restore the original room_type constraint.

BEGIN;

ALTER TABLE public.hostel_requests
  DROP COLUMN IF EXISTS stay_preference;

ALTER TABLE public.hostel_requests
  DROP CONSTRAINT IF EXISTS hostel_requests_room_type_check;

ALTER TABLE public.hostel_requests
  ADD CONSTRAINT hostel_requests_room_type_check
    CHECK (room_type IN ('single', 'shared', 'bedsitter', 'no_preference'));

COMMIT;
