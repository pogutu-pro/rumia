-- Verification status columns on listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_source TEXT,
  ADD COLUMN IF NOT EXISTS verified_date DATE,
  ADD COLUMN IF NOT EXISTS discrepancy_review_needed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS official_record_no_listing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_contact_detected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_review_needed BOOLEAN DEFAULT false;

-- Official DeKUT hostel records (93 records from DeKUT Directorate of Students' Welfare)
CREATE TABLE IF NOT EXISTS dekut_official_hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_name TEXT NOT NULL,
  zone TEXT NOT NULL,
  contacts TEXT NOT NULL,
  payments TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'DeKUT Official Housing List',
  verified_date DATE NOT NULL DEFAULT '2026-07-14',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for phone-based lookups (most common query path)
CREATE INDEX IF NOT EXISTS idx_dekut_official_hostels_zone ON dekut_official_hostels(zone);

-- Tracking table for verification runs (audit trail)
CREATE TABLE IF NOT EXISTS listing_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  official_hostel_id UUID REFERENCES dekut_official_hostels(id),
  match_type TEXT NOT NULL CHECK (match_type IN ('phone', 'name', 'manual', 'none')),
  match_confidence NUMERIC,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_source TEXT,
  verified_date DATE,
  flags TEXT[] DEFAULT '{}',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_verifications_listing ON listing_verifications(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_verifications_official ON listing_verifications(official_hostel_id);
