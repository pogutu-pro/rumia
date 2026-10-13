-- DOWN for 20260818000001_add_reviews_system.sql
-- Manual-rollback documentation only. NOT applied by `supabase db push`.
-- Reverts: review_moderation_log, review_replies, review_likes, reviews tables
-- and their RLS policies/triggers/functions.
BEGIN;

DROP POLICY IF EXISTS moderation_log_select_admin ON public.review_moderation_log;
DROP TABLE IF EXISTS public.review_moderation_log;

DROP POLICY IF EXISTS review_replies_delete_admin ON public.review_replies;
DROP POLICY IF EXISTS review_replies_update_admin ON public.review_replies;
DROP POLICY IF EXISTS review_replies_delete_own ON public.review_replies;
DROP POLICY IF EXISTS review_replies_update_own ON public.review_replies;
DROP POLICY IF EXISTS review_replies_insert_own ON public.review_replies;
DROP POLICY IF EXISTS review_replies_select_admin ON public.review_replies;
DROP POLICY IF EXISTS review_replies_select_own ON public.review_replies;
DROP POLICY IF EXISTS review_replies_select_published ON public.review_replies;
DROP TRIGGER IF EXISTS review_replies_updated_at ON public.review_replies;
DROP TABLE IF EXISTS public.review_replies;
DROP FUNCTION IF EXISTS public.set_review_replies_updated_at();

DROP POLICY IF EXISTS review_likes_delete_own ON public.review_likes;
DROP POLICY IF EXISTS review_likes_insert_own ON public.review_likes;
DROP POLICY IF EXISTS review_likes_select_own ON public.review_likes;
DROP POLICY IF EXISTS review_likes_select_published ON public.review_likes;
DROP TABLE IF EXISTS public.review_likes;

DROP POLICY IF EXISTS reviews_delete_manager ON public.reviews;
DROP POLICY IF EXISTS reviews_update_manager ON public.reviews;
DROP POLICY IF EXISTS reviews_delete_admin ON public.reviews;
DROP POLICY IF EXISTS reviews_update_admin ON public.reviews;
DROP POLICY IF EXISTS reviews_delete_own ON public.reviews;
DROP POLICY IF EXISTS reviews_update_own ON public.reviews;
DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
DROP POLICY IF EXISTS reviews_select_manager ON public.reviews;
DROP POLICY IF EXISTS reviews_select_admin ON public.reviews;
DROP POLICY IF EXISTS reviews_select_own ON public.reviews;
DROP POLICY IF EXISTS reviews_select_published ON public.reviews;
DROP TRIGGER IF EXISTS reviews_updated_at ON public.reviews;
DROP TABLE IF EXISTS public.reviews;
DROP FUNCTION IF EXISTS public.set_reviews_updated_at();

COMMIT;
