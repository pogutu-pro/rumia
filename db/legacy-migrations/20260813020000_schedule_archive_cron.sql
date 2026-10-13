-- 20260813020000: Schedule the listing_views archive with pg_cron.
-- The initial rollup migration's guarded DO block skipped scheduling because
-- `cron.unschedule` raised for a not-yet-existing job. This migration schedules
-- idempotently: unschedule only if the job already exists, then schedule.
-- The probabilistic insert trigger remains as a fallback regardless.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    IF EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'archive-listing-views'
    ) THEN
      PERFORM cron.unschedule('archive-listing-views');
    END IF;

    PERFORM cron.schedule('archive-listing-views', '0 4 * * *', 'SELECT public.archive_listing_views()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;
