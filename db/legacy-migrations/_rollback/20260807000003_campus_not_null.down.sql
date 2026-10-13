-- DOWN for 20260807000003_campus_not_null.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts the NOT NULL constraints back to nullable (run before backfill down).
BEGIN;

ALTER TABLE public.profiles ALTER COLUMN campus_id DROP NOT NULL;
ALTER TABLE public.agents   ALTER COLUMN campus_id DROP NOT NULL;
ALTER TABLE public.listings ALTER COLUMN campus_id DROP NOT NULL;

COMMIT;