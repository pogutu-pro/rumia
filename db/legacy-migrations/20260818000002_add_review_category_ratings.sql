-- Category ratings for hostel reviews.
-- Each category is nullable (partial ratings allowed). The stored reviews.rating
-- remains the computed overall (equal-weight average of non-null categories),
-- computed by the server action so existing aggregation/RBAC code keeps working.
--
-- A summary RPC (get_review_summary) centralizes overall + distribution +
-- per-category aggregation so weighting can be introduced later in one place.

BEGIN;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS rating_cleanliness SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_security      SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_water         SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_wifi          SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_facilities    SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_location      SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_management    SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_value         SMALLINT;

-- Enforce 1..5 on each category column (NULL allowed = "not rated")
ALTER TABLE public.reviews
  ADD CONSTRAINT rating_cleanliness_range_check CHECK (rating_cleanliness IS NULL OR (rating_cleanliness >= 1 AND rating_cleanliness <= 5)),
  ADD CONSTRAINT rating_security_range_check      CHECK (rating_security IS NULL OR (rating_security >= 1 AND rating_security <= 5)),
  ADD CONSTRAINT rating_water_range_check         CHECK (rating_water IS NULL OR (rating_water >= 1 AND rating_water <= 5)),
  ADD CONSTRAINT rating_wifi_range_check          CHECK (rating_wifi IS NULL OR (rating_wifi >= 1 AND rating_wifi <= 5)),
  ADD CONSTRAINT rating_facilities_range_check    CHECK (rating_facilities IS NULL OR (rating_facilities >= 1 AND rating_facilities <= 5)),
  ADD CONSTRAINT rating_location_range_check      CHECK (rating_location IS NULL OR (rating_location >= 1 AND rating_location <= 5)),
  ADD CONSTRAINT rating_management_range_check    CHECK (rating_management IS NULL OR (rating_management >= 1 AND rating_management <= 5)),
  ADD CONSTRAINT rating_value_range_check         CHECK (rating_value IS NULL OR (rating_value >= 1 AND rating_value <= 5));

-- Column-level write control: extend the existing UPDATE grant so the client
-- can only write the rating/text/category columns (never status/verification).
REVOKE UPDATE ON public.reviews FROM anon, authenticated;
GRANT UPDATE (
  rating, text,
  rating_cleanliness, rating_security, rating_water, rating_wifi,
  rating_facilities, rating_location, rating_management, rating_value
) ON public.reviews TO authenticated;

-- ── Summary RPC ──────────────────────────────────────────────────────────
-- Aggregates only published reviews. Overall = equal-weight average of all
-- submitted category ratings. Distribution is bucketed by the stored rounded
-- overall. Per-category averages include only reviews that rated that category.
CREATE OR REPLACE FUNCTION public.get_review_summary(p_listing_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'average_rating', COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1)::float FROM public.reviews
       WHERE listing_id = p_listing_id AND status = 'published'),
      0
    ),
    'total_reviews', (SELECT count(*)::int FROM public.reviews
                      WHERE listing_id = p_listing_id AND status = 'published'),
    'distribution', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.rating DESC)
      FROM (
        SELECT rating, count(*)::int AS count
        FROM public.reviews
        WHERE listing_id = p_listing_id AND status = 'published'
        GROUP BY rating
      ) d
    ), '[]'::jsonb),
    'categories', COALESCE((
      SELECT jsonb_agg(row_to_json(cat) ORDER BY cat.ord)
      FROM (
        SELECT
          cat.key, cat.label,
          ROUND(AVG(cat.v)::numeric, 1)::float AS average,
          count(cat.v)::int AS count,
          cat.ord
        FROM public.reviews r
        CROSS JOIN LATERAL (VALUES
          ('cleanliness', 'Cleanliness', r.rating_cleanliness, 1),
          ('security',    'Security',    r.rating_security,    2),
          ('water',       'Water',       r.rating_water,       3),
          ('wifi',        'Wi-Fi',       r.rating_wifi,        4),
          ('facilities',  'Facilities',  r.rating_facilities,  5),
          ('location',    'Location',    r.rating_location,    6),
          ('management',  'Management',  r.rating_management,  7),
          ('value',       'Value',       r.rating_value,       8)
        ) AS cat(key, label, v, ord)
        WHERE r.listing_id = p_listing_id AND r.status = 'published'
          AND cat.v IS NOT NULL
        GROUP BY cat.key, cat.label, cat.ord
      ) cat
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_review_summary(uuid) TO anon, authenticated;

COMMIT;