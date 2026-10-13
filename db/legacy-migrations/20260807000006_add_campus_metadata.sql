-- Add SEO / social / manifest metadata columns to the campuses table.
--
-- Phase 2: the homepage metadata, OG tags and PWA manifest copy are brand-level
-- strings that were hardcoded in the app. They now live alongside the rest of the
-- campus copy instead, and the app reads them via getCampusBySlug('dekut'). These
-- are ADDITIVE TEXT/JSONB columns; the single live DeKUT row is backfilled from the
-- exact literals currently in the source so rendering stays byte-identical.
--
-- Rollback lives in supabase/migrations/_rollback/20260807000006_add_campus_metadata.down.sql
-- (documentation only; NOT applied by `supabase db push`).

BEGIN;

ALTER TABLE public.campuses
  ADD COLUMN IF NOT EXISTS seo_title            TEXT,
  ADD COLUMN IF NOT EXISTS seo_description      TEXT,
  ADD COLUMN IF NOT EXISTS seo_keywords         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS og_title             TEXT,
  ADD COLUMN IF NOT EXISTS og_description       TEXT,
  ADD COLUMN IF NOT EXISTS twitter_description  TEXT,
  ADD COLUMN IF NOT EXISTS manifest_name        TEXT,
  ADD COLUMN IF NOT EXISTS manifest_description TEXT,
  ADD COLUMN IF NOT EXISTS short_name           TEXT;

-- Backfill the single live DeKUT campus from current production literals.
UPDATE public.campuses
SET
  seo_title           = 'Find Student Hostels Near DeKUT Nyeri',
  seo_description     = 'Discover verified student hostels near Dedan Kimathi University of Technology in Nyeri. Browse self-contained and shared rooms with direct agent contact. No fees.',
  seo_keywords        = '["student hostels near DeKUT","student accommodation Nyeri","DeKUT hostels","Dedan Kimathi University hostels","student housing Nyeri Kenya","verified hostels near DeKUT"]'::jsonb,
  og_title            = 'Find Student Hostels Near DeKUT Nyeri | Rumia',
  og_description      = 'Discover verified student hostels near Dedan Kimathi University of Technology, Nyeri. Browse self-contained & shared rooms. Contact agents directly on WhatsApp.',
  twitter_description = 'Discover verified student hostels near Dedan Kimathi University of Technology, Nyeri. Browse self-contained & shared rooms.',
  manifest_name       = 'Rumia — DeKUT Hostels',
  manifest_description = 'Find verified student hostels near DeKUT, Nyeri.',
  short_name          = 'DeKUT'
WHERE slug = 'dekut';

COMMIT;