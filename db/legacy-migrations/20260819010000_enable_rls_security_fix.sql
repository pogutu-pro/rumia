-- ─────────────────────────────────────────────────────────────
-- Enable RLS Security Fix for Public Tables
-- Resolves 'rls_disabled_in_public' security vulnerability alert
-- ─────────────────────────────────────────────────────────────

-- 1. Enable RLS on core base schema tables that had policies defined but missing ENABLE ROW LEVEL SECURITY
ALTER TABLE IF EXISTS public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.listing_room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.commissions ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on newly created verification & analytics tables
ALTER TABLE IF EXISTS public.dekut_official_hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.listing_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.listing_view_daily_rollup ENABLE ROW LEVEL SECURITY;

-- ── Policies for dekut_official_hostels ───────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dekut_official_hostels') THEN
    DROP POLICY IF EXISTS "dekut_official_hostels_select_public" ON public.dekut_official_hostels;
    CREATE POLICY "dekut_official_hostels_select_public"
      ON public.dekut_official_hostels FOR SELECT
      USING (true);
  END IF;
END $$;

-- ── Policies for listing_verifications ───────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'listing_verifications') THEN
    DROP POLICY IF EXISTS "listing_verifications_select_authenticated" ON public.listing_verifications;
    CREATE POLICY "listing_verifications_select_authenticated"
      ON public.listing_verifications FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ── Policies for listing_view_daily_rollup ────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'listing_view_daily_rollup') THEN
    DROP POLICY IF EXISTS "listing_view_daily_rollup_select_public" ON public.listing_view_daily_rollup;
    CREATE POLICY "listing_view_daily_rollup_select_public"
      ON public.listing_view_daily_rollup FOR SELECT
      USING (true);
  END IF;
END $$;
