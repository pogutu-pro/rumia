-- Add campus FK columns to listings, agents, profiles + extend the role check.
--
-- Additive: only ADD COLUMN (nullable) and extend the existing profiles_role_check
-- CHECK constraint. Existing DeKUT-only data is backfilled in the NEXT migration
-- (20260807000002_backfill_campus) before these columns are constrained NOT NULL.
--
-- No column is dropped or renamed; nothing readable by the current app changes shape.

BEGIN;

-- ── campus_id on listings (the "hostels" table) ─────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id);

-- ── campus_id on agents ──────────────────────────────────────────────────────
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id);

-- ── campus fields on profiles (the "users" table) ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id),
  ADD COLUMN IF NOT EXISTS home_campus_id UUID REFERENCES public.campuses(id),
  ADD COLUMN IF NOT EXISTS managed_campus_id UUID REFERENCES public.campuses(id);

-- ── Extend the role representation (single source of truth: profiles.role) ──
-- Existing CHECK was: role IN ('student', 'agent', 'admin')
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'agent', 'admin', 'manager', 'super_admin'));

-- ── Indexes for fast campus filtering ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_campus_id   ON public.listings (campus_id);
CREATE INDEX IF NOT EXISTS idx_agents_campus_id     ON public.agents (campus_id);
CREATE INDEX IF NOT EXISTS idx_profiles_campus_id   ON public.profiles (campus_id);
CREATE INDEX IF NOT EXISTS idx_profiles_home_campus_id ON public.profiles (home_campus_id);
CREATE INDEX IF NOT EXISTS idx_profiles_managed_campus_id ON public.profiles (managed_campus_id);

COMMIT;