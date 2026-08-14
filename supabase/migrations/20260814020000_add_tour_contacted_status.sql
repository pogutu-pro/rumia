-- Add the 'contacted' status for tour bookings.
-- Set automatically when an agent (or admin) messages the student via the
-- one-tap WhatsApp confirm button on the tours dashboard. The other statuses
-- are kept for backwards compatibility with existing bookings.

BEGIN;

ALTER TABLE public.tour_bookings
  DROP CONSTRAINT IF EXISTS tour_bookings_status_check;

ALTER TABLE public.tour_bookings
  ADD CONSTRAINT tour_bookings_status_check
  CHECK (
    status IN (
      'pending_payment',
      'confirmed',
      'paid',
      'contacted',
      'completed',
      'no_show',
      'cancelled'
    )
  );

COMMIT;