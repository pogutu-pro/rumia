-- Returns the top N most-viewed active listings (all-time).
-- Used by the homepage "Popular on Rumia" section.

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
  ORDER BY vc.cnt DESC NULLS LAST, l.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_listings(INT) TO anon, authenticated;
