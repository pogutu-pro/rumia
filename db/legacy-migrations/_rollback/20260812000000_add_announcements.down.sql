-- Rollback for 20260812000000_add_announcements.

DROP TRIGGER IF EXISTS announcements_updated_at ON public.announcements;
DROP TABLE IF EXISTS public.announcements;
