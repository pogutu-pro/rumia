-- Manager-configurable agent consultation fee.
--
-- The fee for a paid agent consultation is stored per campus so the campus
-- manager can update it from the Manager Dashboard / Payments page. The value
-- is used in WhatsApp inquiry messages and in the contact-modal fee disclosure.
--
-- Additive: new column only. Existing rows backfill to the current default.

BEGIN;

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC NOT NULL DEFAULT 50;

COMMIT;
