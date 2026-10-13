-- The live database has these objects but the migration history did not create them, so a database
-- rebuilt from migrations (CI, staging, a new environment) was missing columns the API reads.
-- Every statement is idempotent: on production they are no-ops.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.campus_zones(id);
CREATE INDEX IF NOT EXISTS idx_listings_zone_id ON public.listings (zone_id);

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS suspension_reason text;
