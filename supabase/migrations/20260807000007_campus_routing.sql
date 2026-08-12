-- Phase 3 (Gate 2) additive migration: campus-scoped routing support.
--
--   1. get_popular_listings gains an optional p_campus_id filter (DEFAULT NULL
--      keeps every existing caller working unchanged). SECURITY DEFINER RPCs
--      bypass RLS, so per-campus scoping must be a parameter, not a policy.
--   2. campuses.hero_image column so the homepage hero can be per-campus
--      (backfilled from the current hardcoded /dekut.jpeg asset).
--   3. feature_flags.landing_chips / landing_zones backfilled for DeKUT so the
--      generic campus landing template reproduces the current landing copy.
--
-- All statements are additive / idempotent (CREATE OR REPLACE, ADD COLUMN IF
-- NOT EXISTS, guarded UPDATEs) and safe to re-run.

BEGIN;

-- ── 1. Campus-scoped get_popular_listings ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_popular_listings(p_limit INT DEFAULT 6, p_campus_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  location TEXT,
  slug TEXT,
  county TEXT,
  area TEXT,
  view_count BIGINT,
  agent_name TEXT,
  r2_url TEXT,
  blur_data_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.title,
    l.description,
    l.price,
    l.location,
    l.slug,
    l.county,
    l.area,
    COALESCE(vc.cnt, 0) AS view_count,
    a.name AS agent_name,
    img.r2_url,
    img.blur_data_url
  FROM listings l
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM listing_views lv
    WHERE lv.listing_id = l.id
  ) vc ON true
  LEFT JOIN agents a ON a.id = l.agent_id
  LEFT JOIN LATERAL (
    SELECT li.r2_url, li.blur_data_url
    FROM listing_images li
    WHERE li.listing_id = l.id
    ORDER BY li.display_order
    LIMIT 1
  ) img ON true
  WHERE l.is_active = true
    AND (p_campus_id IS NULL OR l.campus_id = p_campus_id)
  ORDER BY vc.cnt DESC NULLS LAST, l.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_listings(INT, UUID) TO anon, authenticated;

-- ── 2. Per-campus hero image ─────────────────────────────────────────────────
ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS hero_image TEXT;

UPDATE public.campuses
SET hero_image = '/dekut.jpeg'
WHERE slug = 'dekut'
  AND hero_image IS NULL;

-- ── 3. Landing template copy for the live DeKUT campus ───────────────────────
UPDATE public.campuses
SET feature_flags = jsonb_build_object(
  'landing_chips', '["Near Gate A","Gichugu Road","Nyeri"]'::jsonb,
  'landing_zones', 'along Gichugu Road, near Gate A, and throughout the surrounding Nyeri neighbourhoods.',
  'landing_seo_description', 'Find verified student hostels near Dedan Kimathi University of Technology in Nyeri. Self-contained, single, and shared rooms along Gichugu Road, Boma, Nyeri view, Nyaribo & Gate A. Book today.'
)
WHERE slug = 'dekut';

COMMIT;
