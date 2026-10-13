-- Rebrand the DeKUT landing copy on /hostels/nyeri/dekut: Gichugu Road is
-- now promoted as Boma. Keeps landing_chips, landing_zones and the SEO
-- description in sync with campus-fallback.ts so a DB hiccup renders the
-- same (rebranded) copy.

BEGIN;

UPDATE public.campuses
SET feature_flags = jsonb_build_object(
  'landing_chips', '["Near Gate A","Boma","Nyeri"]'::jsonb,
  'landing_zones', 'around Boma, near Gate A, and throughout the surrounding Nyeri neighbourhoods.',
  'landing_seo_description', 'Find verified student hostels near Dedan Kimathi University of Technology in Nyeri. Self-contained, single, and shared rooms in Boma, Nyeri View, Nyaribo and Gate A. Book today.'
)
WHERE slug = 'dekut';

COMMIT;