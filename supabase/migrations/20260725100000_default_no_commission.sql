-- All hostels default to NOT paying commission.
-- Agents or admin must explicitly opt-in to commission.
-- This changes the column default AND flips all existing rows.

-- 1. Set all existing listings to pays_commission = false
UPDATE listings SET pays_commission = false WHERE pays_commission = true;

-- 2. Change the column default for new listings
ALTER TABLE listings ALTER COLUMN pays_commission SET DEFAULT false;
