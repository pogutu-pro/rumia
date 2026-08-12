-- DOWN for 20260807000006_add_campus_metadata.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts the SEO / social / manifest metadata columns added to campuses
-- and empties their values off the backfilled DeKUT row.
BEGIN;

UPDATE public.campuses
SET
  seo_title = NULL,
  seo_description = NULL,
  seo_keywords = '[]'::jsonb,
  og_title = NULL,
  og_description = NULL,
  twitter_description = NULL,
  manifest_name = NULL,
  manifest_description = NULL,
  short_name = NULL
WHERE slug = 'dekut';

ALTER TABLE public.campuses
  DROP COLUMN IF EXISTS short_name,
  DROP COLUMN IF EXISTS manifest_description,
  DROP COLUMN IF EXISTS manifest_name,
  DROP COLUMN IF EXISTS twitter_description,
  DROP COLUMN IF EXISTS og_description,
  DROP COLUMN IF EXISTS og_title,
  DROP COLUMN IF EXISTS seo_keywords,
  DROP COLUMN IF EXISTS seo_description,
  DROP COLUMN IF EXISTS seo_title;

COMMIT;