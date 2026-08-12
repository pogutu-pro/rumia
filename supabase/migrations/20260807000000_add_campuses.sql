-- Campus registry for multi-campus Rumia.
--
-- Additive / backward-compatible: creates a brand-new table and seeds the
-- single live DeKUT campus from the values currently hardcoded in the app,
-- without touching any existing table. Nothing downstream changes until a
-- later phase adds the campus-picker/routing layer.
--
-- Live values sourced from the Gate-1 audit (see report §2.2):
--   hero_headline     -> src/app/(public)/page.tsx:90   "Student Hostels Near DeKUT, Nyeri"
--   hero_subtext      -> src/app/(public)/page.tsx:93-99
--   whatsapp_number   -> +254114845619 (footer, report form, dashboard defaults)
--   primary_color     -> emerald #10B981 (resolved from --primary HSL 154 85% 30% / themes.css)
--   city              -> Nyeri

BEGIN;

CREATE TABLE IF NOT EXISTS public.campuses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  city           TEXT NOT NULL,
  hero_headline  TEXT NOT NULL,
  hero_subtext   TEXT,
  whatsapp_number TEXT NOT NULL,
  primary_color  TEXT NOT NULL,
  feature_flags  JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'coming_soon')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the live DeKUT campus from production values.
INSERT INTO public.campuses (
  slug, name, city, hero_headline, hero_subtext, whatsapp_number, primary_color, feature_flags, status
) VALUES (
  'dekut',
  'Dedan Kimathi University of Technology',
  'Nyeri',
  'Student Hostels Near DeKUT, Nyeri',
  'Discover verified student hostels near Dedan Kimathi University of Technology in Nyeri, Kenya. Contact agents directly on WhatsApp and book a tour.',
  '+254114845619',
  '#10B981',
  '{}'::jsonb,
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Public read of campus metadata (needed by future campus-picker / routing.
-- content is not sensitive). Strip RLS on an infrequently-updated registry.
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campuses_select_public"
  ON public.campuses FOR SELECT
  USING (true);

COMMIT;