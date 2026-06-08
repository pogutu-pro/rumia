-- Location and listing analytics support.
-- This migration is intentionally data-preserving: it patches missing pieces
-- without dropping or recreating existing tables.

-- Listings already have these columns in current local migrations. Keep data,
-- but make future unresolved locations explicitly nullable instead of defaulting
-- to DeKUT coordinates.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

ALTER TABLE listings
  ALTER COLUMN latitude DROP DEFAULT,
  ALTER COLUMN longitude DROP DEFAULT;

-- Minimal profile records so listing_views.user_id has a stable public FK target.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'agent', 'admin'));

INSERT INTO profiles (id, email, role, created_at)
SELECT
  u.id,
  u.email,
  CASE
    WHEN u.email ILIKE '%admin%' OR lower(u.email) = 'paul@rumia.co.ke' THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM agents a WHERE a.user_id = u.id) THEN 'agent'
    ELSE 'student'
  END,
  COALESCE(u.created_at, NOW())
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  role = CASE
    WHEN profiles.role = 'admin' THEN 'admin'
    WHEN EXCLUDED.role = 'admin' THEN 'admin'
    ELSE EXCLUDED.role
  END;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE
      WHEN NEW.email ILIKE '%admin%' OR lower(NEW.email) = 'paul@rumia.co.ke' THEN 'admin'
      ELSE 'student'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Listing view event storage. Create only if absent, otherwise patch missing
-- columns and constraints.
CREATE TABLE IF NOT EXISTS listing_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_hash TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE listing_views
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS listing_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listing_views_pkey'
      AND conrelid = 'public.listing_views'::regclass
  ) THEN
    ALTER TABLE listing_views ADD CONSTRAINT listing_views_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listing_views_listing_id_fkey'
      AND conrelid = 'public.listing_views'::regclass
  ) THEN
    ALTER TABLE listing_views
      ADD CONSTRAINT listing_views_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listing_views_user_id_fkey'
      AND conrelid = 'public.listing_views'::regclass
  ) THEN
    ALTER TABLE listing_views
      ADD CONSTRAINT listing_views_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id_viewed_at
  ON listing_views (listing_id, viewed_at);

CREATE INDEX IF NOT EXISTS idx_listing_views_user_recent
  ON listing_views (listing_id, user_id, viewed_at)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listing_views_ip_recent
  ON listing_views (listing_id, ip_hash, viewed_at)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_views_insert_public" ON listing_views;
CREATE POLICY "listing_views_insert_public"
  ON listing_views FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "listing_views_select_owner_or_admin" ON listing_views;
CREATE POLICY "listing_views_select_owner_or_admin"
  ON listing_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM listings l
      JOIN agents a ON a.id = l.agent_id
      WHERE l.id = listing_views.listing_id
        AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.rumia_period_bounds()
RETURNS TABLE (
  today_start TIMESTAMPTZ,
  week_start TIMESTAMPTZ,
  month_start TIMESTAMPTZ,
  year_start TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    date_trunc('day', timezone('Africa/Nairobi', now())) AT TIME ZONE 'Africa/Nairobi',
    date_trunc('week', timezone('Africa/Nairobi', now())) AT TIME ZONE 'Africa/Nairobi',
    date_trunc('month', timezone('Africa/Nairobi', now())) AT TIME ZONE 'Africa/Nairobi',
    date_trunc('year', timezone('Africa/Nairobi', now())) AT TIME ZONE 'Africa/Nairobi';
$$;

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
    COUNT(*) AS all_time_count
  FROM listing_views lv
  CROSS JOIN bounds
  WHERE lv.listing_id = p_listing_id;
$$;

CREATE OR REPLACE FUNCTION public.track_listing_view(
  p_listing_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_is_agent BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_duplicate BOOLEAN := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM listings WHERE id = p_listing_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('inserted', false, 'reason', 'listing_not_found');
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT p.id, p.role = 'admin'
    INTO v_profile_id, v_is_admin
    FROM profiles p
    WHERE p.id = p_user_id;

    SELECT EXISTS (SELECT 1 FROM agents a WHERE a.user_id = p_user_id)
    INTO v_is_agent;
  END IF;

  IF v_profile_id IS NOT NULL AND NOT v_is_agent AND NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1
      FROM listing_views
      WHERE listing_id = p_listing_id
        AND user_id = v_profile_id
        AND viewed_at >= now() - INTERVAL '24 hours'
    )
    INTO v_duplicate;

    IF NOT v_duplicate THEN
      INSERT INTO listing_views (listing_id, user_id, ip_hash)
      VALUES (p_listing_id, v_profile_id, p_ip_hash);
    END IF;

    RETURN jsonb_build_object('inserted', NOT v_duplicate, 'dedupe', 'user');
  END IF;

  IF p_ip_hash IS NULL OR length(trim(p_ip_hash)) = 0 THEN
    RETURN jsonb_build_object('inserted', false, 'reason', 'missing_ip_hash');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM listing_views
    WHERE listing_id = p_listing_id
      AND ip_hash = p_ip_hash
      AND viewed_at >= now() - INTERVAL '6 hours'
  )
  INTO v_duplicate;

  IF NOT v_duplicate THEN
    INSERT INTO listing_views (listing_id, user_id, ip_hash)
    VALUES (p_listing_id, NULL, p_ip_hash);
  END IF;

  RETURN jsonb_build_object('inserted', NOT v_duplicate, 'dedupe', 'ip');
END;
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
  WITH requester AS (
    SELECT auth.uid() AS user_id
  ),
  authorized AS (
    SELECT 1
    FROM agents a, requester r
    WHERE a.id = p_agent_id
      AND a.user_id = r.user_id
  ),
  bounds AS (
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
    COUNT(lv.id) AS all_time_count
  FROM listings l
  CROSS JOIN bounds
  LEFT JOIN listing_views lv ON lv.listing_id = l.id
  WHERE l.agent_id = p_agent_id
    AND EXISTS (SELECT 1 FROM authorized)
  GROUP BY l.id, l.title, l.slug, l.county, l.area
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
    COUNT(lv.id) AS all_time_count
  FROM listings l
  JOIN agents a ON a.id = l.agent_id
  CROSS JOIN bounds
  LEFT JOIN listing_views lv ON lv.listing_id = l.id
  GROUP BY l.id, l.title, l.slug, l.county, l.area, a.name, l.location
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
    COUNT(lv.id) AS all_time_count
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
    COUNT(*) AS all_time_count
  FROM listing_views lv
  CROSS JOIN bounds;
$$;

CREATE OR REPLACE FUNCTION public.get_registered_student_count()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM profiles p
  WHERE p.role <> 'admin'
    AND NOT EXISTS (
      SELECT 1
      FROM agents a
      WHERE a.user_id = p.id
    );
$$;

REVOKE ALL ON FUNCTION public.get_listing_view_counts(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_listing_view(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_agent_listing_view_analytics(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_listing_view_analytics(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_agent_view_analytics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_platform_view_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_registered_student_count() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_listing_view_counts(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_listing_view(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_listing_view_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_listing_view_analytics(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_agent_view_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_view_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_registered_student_count() TO service_role;
