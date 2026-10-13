-- Student authentication features: Google OAuth profiles + saved hostels

-- ── Extend profiles with student metadata ────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── Saved hostels (favorites) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_hostels_user
  ON saved_hostels (user_id, created_at DESC);

ALTER TABLE saved_hostels ENABLE ROW LEVEL SECURITY;

-- Students can view their own saved hostels
DROP POLICY IF EXISTS "saved_hostels_select_own" ON saved_hostels;
CREATE POLICY "saved_hostels_select_own"
  ON saved_hostels FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Students can save hostels for themselves only
DROP POLICY IF EXISTS "saved_hostels_insert_own" ON saved_hostels;
CREATE POLICY "saved_hostels_insert_own"
  ON saved_hostels FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Students can remove their own saved hostels
DROP POLICY IF EXISTS "saved_hostels_delete_own" ON saved_hostels;
CREATE POLICY "saved_hostels_delete_own"
  ON saved_hostels FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── Profile update RLS policy ─────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Update auto-profile trigger to capture Google OAuth metadata ──────
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE
      WHEN NEW.email ILIKE '%admin%' OR lower(NEW.email) IN ('paul@rumia.co.ke', 'paul.katam025@gmail.com') THEN 'admin'
      ELSE 'student'
    END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;
