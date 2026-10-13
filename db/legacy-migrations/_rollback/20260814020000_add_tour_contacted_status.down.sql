-- Rollback: remove the 'contacted' status for tour bookings.

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
      'completed',
      'no_show',
      'cancelled'
    )
  );

COMMIT;