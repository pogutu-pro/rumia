-- Kenya counties as a fixed reference dataset (Part B correction).
--
-- Regions are NOT a free-form, admin-creatable grouping. They are the 47
-- Kenyan counties and nothing else:
--   • This migration seeds exactly the 47 counties, once (idempotent).
--   • It normalises the display name of any pre-existing row that surfaced
--     with a canonical slug but a non-canonical name.
--   • It removes any legacy/freeform region rows that don't match the 47.
--   • It demotes the regions table RLS to read-only for every API role so the
--     rows can never be created/edited/deleted from the app.
--   • It backfills campuses.region_id from each campus's city/county name
--     (DeKUT city 'Nyeri' -> Nyeri County).
--   • It adds the phone / email / social_links columns that the campus
--     Settings UI already writes to (they were referenced by
--     updateCampusSettingsAction but never migrated - a dead write).
--
-- Additive + idempotent. Leave every existing row untouched.
-- Rollback: supabase/migrations/_rollback/20260808000000_seed_counties_and_contact.down.sql

BEGIN;

-- ── 1. Seed + normalise the 47 counties from a single canonical source ────
WITH canonical (name, slug) AS (VALUES
  ('Baringo', 'baringo'),
  ('Bomet', 'bomet'),
  ('Bungoma', 'bungoma'),
  ('Busia', 'busia'),
  ('Elgeyo-Marakwet', 'elgeyo-marakwet'),
  ('Embu', 'embu'),
  ('Garissa', 'garissa'),
  ('Homa Bay', 'homa-bay'),
  ('Isiolo', 'isiolo'),
  ('Kajiado', 'kajiado'),
  ('Kakamega', 'kakamega'),
  ('Kericho', 'kericho'),
  ('Kiambu', 'kiambu'),
  ('Kilifi', 'kilifi'),
  ('Kirinyaga', 'kirinyaga'),
  ('Kisii', 'kisii'),
  ('Kisumu', 'kisumu'),
  ('Kitui', 'kitui'),
  ('Kwale', 'kwale'),
  ('Laikipia', 'laikipia'),
  ('Lamu', 'lamu'),
  ('Machakos', 'machakos'),
  ('Makueni', 'makueni'),
  ('Mandera', 'mandera'),
  ('Marsabit', 'marsabit'),
  ('Meru', 'meru'),
  ('Migori', 'migori'),
  ('Mombasa', 'mombasa'),
  ('Murang''a', 'muranga'),
  ('Nairobi', 'nairobi'),
  ('Nakuru', 'nakuru'),
  ('Nandi', 'nandi'),
  ('Narok', 'narok'),
  ('Nyamira', 'nyamira'),
  ('Nyeri', 'nyeri'),
  ('Samburu', 'samburu'),
  ('Siaya', 'siaya'),
  ('Taita-Taveta', 'taita-taveta'),
  ('Tana River', 'tana-river'),
  ('Tharaka-Nithi', 'tharaka-nithi'),
  ('Trans-Nzoia', 'trans-nzoia'),
  ('Turkana', 'turkana'),
  ('Uasin Gishu', 'uasin-gishu'),
  ('Vihiga', 'vihiga'),
  ('Wajir', 'wajir'),
  ('West Pokot', 'west-pokot'),
  ('Wundanyi/Gurar', 'gurar')
)
INSERT INTO public.regions (name, slug)
SELECT name, slug FROM canonical
ON CONFLICT (slug) DO NOTHING;

-- Normalise display names of any row that already had a canonical slug.
WITH canonical (name, slug) AS (
  VALUES
  ('Baringo', 'baringo'),
  ('Bomet', 'bomet'),
  ('Bungoma', 'bungoma'),
  ('Busia', 'busia'),
  ('Elgeyo-Marakwet', 'elgeyo-marakwet'),
  ('Embu', 'embu'),
  ('Garissa', 'garissa'),
  ('Homa Bay', 'homa-bay'),
  ('Isiolo', 'isiolo'),
  ('Kajiado', 'kajiado'),
  ('Kakamega', 'kakamega'),
  ('Kericho', 'kericho'),
  ('Kiambu', 'kiambu'),
  ('Kilifi', 'kilifi'),
  ('Kirinyaga', 'kirinyaga'),
  ('Kisii', 'kisii'),
  ('Kisumu', 'kisumu'),
  ('Kitui', 'kitui'),
  ('Kwale', 'kwale'),
  ('Laikipia', 'laikipia'),
  ('Lamu', 'lamu'),
  ('Machakos', 'machakos'),
  ('Makueni', 'makueni'),
  ('Mandera', 'mandera'),
  ('Marsabit', 'marsabit'),
  ('Meru', 'meru'),
  ('Migori', 'migori'),
  ('Mombasa', 'mombasa'),
  ('Murang''a', 'muranga'),
  ('Nairobi', 'nairobi'),
  ('Nakuru', 'nakuru'),
  ('Nandi', 'nandi'),
  ('Narok', 'narok'),
  ('Nyamira', 'nyamira'),
  ('Nyeri', 'nyeri'),
  ('Samburu', 'samburu'),
  ('Siaya', 'siaya'),
  ('Taita-Taveta', 'taita-taveta'),
  ('Tana River', 'tana-river'),
  ('Tharaka-Nithi', 'tharaka-nithi'),
  ('Trans-Nzoia', 'trans-nzoia'),
  ('Turkana', 'turkana'),
  ('Uasin Gishu', 'uasin-gishu'),
  ('Vihiga', 'vihiga'),
  ('Wajir', 'wajir'),
  ('West Pokot', 'west-pokot'),
  ('Wundanyi/Gurar', 'gurar')
)
UPDATE public.regions r
   SET name = c.name
  FROM canonical c
 WHERE r.slug = c.slug
   AND r.name IS DISTINCT FROM c.name;

-- ── 2. Reconcile / remove anything that is not one of the 47 counties ──────
-- ON DELETE SET NULL on campuses.region_id + profiles.managed_region_id means
-- a dropped freeform reference simply becomes NULL; the end of this migration
-- backfills every campus row, so no campus can end up region-less.
DELETE FROM public.regions r
WHERE r.slug NOT IN (
  'baringo','bomet','bungoma','busia','elgeyo-marakwet','embu','garissa',
  'homa-bay','isiolo','kajiado','kakamega','kericho','kiambu','kilifi',
  'kirinyaga','kisii','kisumu','kitui','kwale','laikipia','lamu','machakos',
  'makueni','mandera','marsabit','meru','migori','mombasa','muranga',
  'nairobi','nakuru','nandi','narok','nyamira','nyeri','samburu','siaya',
  'taita-taveta','tana-river','tharaka-nithi','trans-nzoia','turkana',
  'uasin-gishu','vihiga','wajir','west-pokot','gurar'
);

-- ── 3. Regions are read-only reference data ──────────────────────────────
-- The previous policy allowed super_admin CRUD (the "Create/Edit/Delete
-- Region" UI it powered). Replace with SELECT-only for everyone; every
-- INSERT/UPDATE/DELETE is denied to non-owner roles regardless of role.
DROP POLICY IF EXISTS "Enable read access for all users on regions" ON public.regions;
DROP POLICY IF EXISTS "Enable full access for super_admin on regions" ON public.regions;
DROP POLICY IF EXISTS "regions_block_writes" ON public.regions;

CREATE POLICY "Enable read access for all users on regions"
  ON public.regions FOR SELECT
  USING (true);

CREATE POLICY "regions_block_writes"
  ON public.regions FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── 4. Add the contact columns the Settings UI writes to ──────────────────
ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS social_links  JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 5. Backfill campuses.region_id from the campus city name ─────────────
-- DeKUT city = 'Nyeri' matches the seeded 'Nyeri' county. General enough to
-- cover any future campus whose `city` equals a county name as well.
UPDATE public.campuses c
   SET region_id = r.id
  FROM public.regions r
 WHERE c.region_id IS NULL
   AND lower(coalesce(trim(c.city), '')) = lower(r.name);

-- ── 6. Region-scoped manager access (A5 fix) ──────────────────────────────
-- is_manager_of_campus previously only honoured managed_campus_id; a manager
-- scoped to a whole region (managed_region_id) had no effect. Promote region
-- scope so a region manager can administrate every campus within their county.
CREATE OR REPLACE FUNCTION public.is_manager_of_campus(p_campus_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_campus_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'manager'
        AND (
          managed_campus_id = p_campus_id
          OR (
            managed_region_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.campuses
              WHERE id = p_campus_id
                AND region_id = managed_region_id
            )
          )
        )
    );
$$;

-- Managers with only a managed_region_id scope need these helpers to exist.
GRANT EXECUTE ON FUNCTION public.is_manager_of_campus(UUID) TO authenticated;

COMMIT;