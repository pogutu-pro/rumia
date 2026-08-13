-- "Find Me a Hostel" form: add a stay preference (alone vs sharing a room to
-- cost share) and extend room type with "one bedroom". Purely additive.
--
-- Existing `room_type` values are kept so legacy rows stay valid; the new
-- `one_bedroom` value is added to the check constraint. `shared` remains a
-- valid legacy value but is no longer offered on the form.

BEGIN;

ALTER TABLE public.hostel_requests
  DROP CONSTRAINT IF EXISTS hostel_requests_room_type_check;

ALTER TABLE public.hostel_requests
  ADD CONSTRAINT hostel_requests_room_type_check
    CHECK (room_type IN ('single', 'shared', 'bedsitter', 'one_bedroom', 'no_preference'));

ALTER TABLE public.hostel_requests
  ADD COLUMN IF NOT EXISTS stay_preference TEXT NOT NULL DEFAULT 'no_preference'
    CHECK (stay_preference IN ('alone', 'sharing', 'no_preference'));

COMMIT;
