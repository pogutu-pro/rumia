-- Manager-configurable hostel-finding service fee.
--
-- The fee for a "Find Me a Hostel" request is stored per campus so the campus
-- manager can update it from the Manager Dashboard (Campus Settings). The value
-- is stamped onto hostel_requests.fee when a request is created and is never
-- shown on the public homepage form — it is only surfaced to the student after
-- they have submitted a request.
--
-- Additive: new column only. Existing rows backfill to the current default.

BEGIN;

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS hostel_finding_fee NUMERIC NOT NULL DEFAULT 100;

COMMIT;