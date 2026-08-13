-- 20260813010000: Bound listing_views growth so the project stays inside the
-- Supabase Free tier 500 MB database cap.
--
-- Problem: every page view inserts a row into listing_views forever. At
-- ~1000 visitors/day × several pages this grows unbounded (~1.8M rows/yr).
--
-- Solution:
--   1. Granular rows are kept for 90 days (covers today/week/month windows).
--   2. Older rows are aggregated into a compact daily rollup table so all-time
--      counts stay accurate without unbounded growth.
--   3. Maintenance runs automatically (pg_cron if available + a probabilistic
--      fallback inside the tracker so it works even with no scheduler).

-- ── 1) Daily rollup table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listing_view_daily_rollup (
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (listing_id, view_date)
);

-- Per-listing lookup for rollup; platform-wide scans stay small (48 × 365 rows/yr).
CREATE INDEX IF NOT EXISTS idx_lv_rollup_listing_id
  ON public.listing_view_daily_rollup (listing_id);

-- Index so the archive's time-range scan stays cheap.
CREATE INDEX IF NOT EXISTS idx_listing_views_viewed_at
  ON public.listing_views (viewed_at);

-- ── 2) Archive + purge ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_listing_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - interval '90 days';
BEGIN
  -- Fast no-op check so idle runs cost an index probe, not a full scan.
  IF NOT EXISTS (
    SELECT 1 FROM public.listing_views WHERE viewed_at < v_cutoff LIMIT 1
  ) THEN
    RETURN;
  END IF;

  -- Fold rows older than 90 days into the daily rollup (idempotent).
  INSERT INTO public.listing_view_daily_rollup (listing_id, view_date, view_count)
  SELECT
    listing_id,
    (viewed_at AT TIME ZONE 'Africa/Nairobi')::date AS view_date,
    COUNT(*) AS view_count
  FROM public.listing_views
  WHERE viewed_at < v_cutoff
  GROUP BY listing_id, (viewed_at AT TIME ZONE 'Africa/Nairobi')::date
  ON CONFLICT (listing_id, view_date) DO UPDATE
    SET view_count = public.listing_view_daily_rollup.view_count + EXCLUDED.view_count;

  -- Purge the archived granular rows.
  DELETE FROM public.listing_views
  WHERE viewed_at < v_cutoff;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_listing_views() TO service_role;

-- ── 3) Probabilistic fallback maintenance (no cron dependency) ─────────────
-- Fires on inserts in the tracker. ~0.5% of the time it runs the archive, so
-- with thousands of views/day the table stays caught up within hours even if
-- pg_cron is unavailable. Overhead per insert is a random() call.
CREATE OR REPLACE FUNCTION public.maybe_archive_listing_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF random() < 0.005 THEN
    PERFORM public.archive_listing_views();
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_views_archive ON public.listing_views;
CREATE TRIGGER trg_listing_views_archive
  AFTER INSERT ON public.listing_views
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.maybe_archive_listing_views();

-- ── 4) pg_cron daily archive (guarded; skipped gracefully if unavailable) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule('archive-listing-views');
    PERFORM cron.schedule('archive-listing-views', '0 4 * * *', 'SELECT public.archive_listing_views()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;

-- ── 5) Read functions include rollup so all-time counts stay accurate ──────

CREATE OR REPLACE FUNCTION public.get_listing_view_counts(p_listing_id UUID)
RETURNS TABLE (
  today_count BIGINT,
  week_count BIGINT,
  month_count BIGINT,
  all_time_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT * FROM public.rumia_period_bounds()
  )
  SELECT
    COUNT(*) FILTER (WHERE lv.viewed_at >= bounds.today_start) AS today_count,
    COUNT(*) FILTER (WHERE lv.viewed_at >= bounds.week_start) AS week_count,
    COUNT(*) FILTER (WHERE lv.viewed_at >= bounds.month_start) AS month_count,
    COUNT(*) + COALESCE(
      (SELECT SUM(view_count) FROM public.listing_view_daily_rollup
       WHERE listing_id = p_listing_id),
      0
    ) AS all_time_count
  FROM listing_views lv
  CROSS JOIN bounds
  WHERE lv.listing_id = p_listing_id;
$$;

CREATE OR REPLACE FUNCTION public.get_agent_listing_view_analytics(p_agent_id UUID)
RETURNS TABLE (
  listing_id UUID,
  listing_title TEXT,
  listing_slug TEXT,
  county TEXT,
  area TEXT,
  today_count BIGINT,
  week_count BIGINT,
  month_count BIGINT,
  all_time_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT * FROM public.rumia_period_bounds()
  )
  SELECT
    l.id,
    l.title,
    l.slug,
    l.county,
    l.area,
    COUNT(lv.id) FILTER (WHERE lv.viewed_at >= bounds.today_start) AS today_count,
    COUNT(lv.id) FILTER (WHERE lv.viewed_at >= bounds.week_start) AS week_count,
    COUNT(lv.id) FILTER (WHERE lv.viewed_at >= bounds.month_start) AS month_count,
    COUNT(lv.id) + COALESCE(rl.rollup_cnt, 0) AS all_time_count
  FROM listings l
  CROSS JOIN bounds
  LEFT JOIN listing_views lv ON lv.listing_id = l.id
  LEFT JOIN LATERAL (
    SELECT SUM(view_count) AS rollup_cnt
    FROM listing_view_daily_rollup
    WHERE listing_id = l.id
  ) rl ON true
  WHERE l.agent_id = p_agent_id
  GROUP BY l.id, l.title, l.slug, l.county, l.area, rl.rollup_cnt
  ORDER BY month_count DESC, l.title ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_listing_view_analytics(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  listing_id UUID,
  listing_title TEXT,
  listing_slug TEXT,
  county TEXT,
  area TEXT,
  agent_name TEXT,
  location TEXT,
  today_count BIGINT,
  week_count BIGINT,
  month_count BIGINT,
  all_time_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT * FROM public.rumia_period_bounds()
  )
  SELECT
    l.id,
    l.title,
    l.slug,
    l.county,
    l.area,
    a.name,
    l.location,
    COUNT(lv.id) FILTER (WHERE lv.viewed_at >= bounds.today_start) AS today_count,
    COUNT(lv.id) FILTER (WHERE lv.viewed_at >= bounds.week_start) AS week_count,
    COUNT(lv.id) FILTER (WHERE lv.viewed_at >= bounds.month_start) AS month_count,
    COUNT(lv.id) + COALESCE(rl.rollup_cnt, 0) AS all_time_count
  FROM listings l
  JOIN agents a ON a.id = l.agent_id
  CROSS JOIN bounds
  LEFT JOIN listing_views lv ON lv.listing_id = l.id
  LEFT JOIN LATERAL (
    SELECT SUM(view_count) AS rollup_cnt
    FROM listing_view_daily_rollup
    WHERE listing_id = l.id
  ) rl ON true
  GROUP BY l.id, l.title, l.slug, l.county, l.area, a.name, l.location, rl.rollup_cnt
  ORDER BY month_count DESC, all_time_count DESC, l.title ASC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;

CREATE OR REPLACE FUNCTION public.get_admin_agent_view_analytics()
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  active_listings_count BIGINT,
  month_count BIGINT,
  all_time_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT * FROM public.rumia_period_bounds()
  )
  SELECT
    a.id,
    a.name,
    COUNT(DISTINCT l.id) FILTER (WHERE l.is_active = true) AS active_listings_count,
    COUNT(lv.id) FILTER (WHERE lv.viewed_at >= bounds.month_start) AS month_count,
    COUNT(lv.id) + COALESCE((
      SELECT SUM(r.view_count)
      FROM listings l2
      JOIN listing_view_daily_rollup r ON r.listing_id = l2.id
      WHERE l2.agent_id = a.id
    ), 0) AS all_time_count
  FROM agents a
  CROSS JOIN bounds
  LEFT JOIN listings l ON l.agent_id = a.id
  LEFT JOIN listing_views lv ON lv.listing_id = l.id
  GROUP BY a.id, a.name
  ORDER BY month_count DESC, all_time_count DESC, a.name ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_view_summary()
RETURNS TABLE (
  today_count BIGINT,
  week_count BIGINT,
  month_count BIGINT,
  all_time_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT * FROM public.rumia_period_bounds()
  )
  SELECT
    COUNT(*) FILTER (WHERE lv.viewed_at >= bounds.today_start) AS today_count,
    COUNT(*) FILTER (WHERE lv.viewed_at >= bounds.week_start) AS week_count,
    COUNT(*) FILTER (WHERE lv.viewed_at >= bounds.month_start) AS month_count,
    COUNT(*) + COALESCE(
      (SELECT SUM(view_count) FROM public.listing_view_daily_rollup),
      0
    ) AS all_time_count
  FROM listing_views lv
  CROSS JOIN bounds;
$$;

CREATE OR REPLACE FUNCTION public.get_popular_listings(p_limit INT DEFAULT 6)
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
    COALESCE(vc.cnt, 0) + COALESCE(rl.rollup_cnt, 0) AS view_count,
    a.name AS agent_name,
    img.r2_url,
    img.blur_data_url
  FROM listings l
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM listing_views lv
    WHERE lv.listing_id = l.id
  ) vc ON true
  LEFT JOIN LATERAL (
    SELECT SUM(view_count) AS rollup_cnt
    FROM listing_view_daily_rollup
    WHERE listing_id = l.id
  ) rl ON true
  LEFT JOIN agents a ON a.id = l.agent_id
  LEFT JOIN LATERAL (
    SELECT li.r2_url, li.blur_data_url
    FROM listing_images li
    WHERE li.listing_id = l.id
    ORDER BY li.display_order
    LIMIT 1
  ) img ON true
  WHERE l.is_active = true
  ORDER BY (COALESCE(vc.cnt, 0) + COALESCE(rl.rollup_cnt, 0)) DESC NULLS LAST,
           l.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_listing_view_counts(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_listing_view(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_listing_view_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_listing_view_analytics(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_agent_view_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_view_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_popular_listings(INT) TO anon, authenticated;
