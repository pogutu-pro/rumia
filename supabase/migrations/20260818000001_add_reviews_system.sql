-- Reviews system: reviews, likes, replies, moderation log.
-- Hard-delete reviews; moderation log preserves content independently.
-- Likes are lightweight (no content to audit). Replies are hard-deleted
-- with their parent review via CASCADE.

BEGIN;

-- ── 1. Reviews ──────────────────────────────────────────────────────────
CREATE TABLE public.reviews (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text       TEXT,
  -- Display-identity snapshot at review time (kept separate from profiles
  -- RLS so public/anonymous readers can render author names/avatars).
  author_name TEXT,
  author_avatar_url TEXT,
  school_verified_at_review_time BOOLEAN NOT NULL DEFAULT false,
  status     TEXT NOT NULL DEFAULT 'published'
               CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One review per user per listing
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_listing_user_unique UNIQUE (listing_id, user_id);

CREATE INDEX idx_reviews_listing_id       ON public.reviews (listing_id);
CREATE INDEX idx_reviews_user_id          ON public.reviews (user_id);
CREATE INDEX idx_reviews_listing_status   ON public.reviews (listing_id, status);
CREATE INDEX idx_reviews_created_at       ON public.reviews (created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_reviews_updated_at();

-- ── 2. Review Likes ─────────────────────────────────────────────────────
CREATE TABLE public.review_likes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id  UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.review_likes
  ADD CONSTRAINT review_likes_unique UNIQUE (review_id, user_id);

CREATE INDEX idx_review_likes_review ON public.review_likes (review_id);
CREATE INDEX idx_review_likes_user   ON public.review_likes (user_id);

-- ── 3. Review Replies ───────────────────────────────────────────────────
CREATE TABLE public.review_replies (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id  UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  author_name TEXT,
  author_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_replies_review ON public.review_replies (review_id);
CREATE INDEX idx_review_replies_user   ON public.review_replies (user_id);

CREATE OR REPLACE FUNCTION public.set_review_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_replies_updated_at
  BEFORE UPDATE ON public.review_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_review_replies_updated_at();

-- ── 4. Moderation Log (preserves content independently) ──────────────────
CREATE TABLE public.review_moderation_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id       UUID,
  review_listing_id UUID,
  review_user_id  UUID,
  actor_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL CHECK (action IN ('status_change', 'text_edit', 'delete')),
  previous_status TEXT,
  new_status      TEXT,
  previous_text   TEXT,
  new_text        TEXT,
  previous_rating SMALLINT,
  new_rating      SMALLINT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No FK on review_id — survives hard-delete of the review.
-- Index on review_id for lookups when reviewing audit history.
CREATE INDEX idx_moderation_log_review  ON public.review_moderation_log (review_id);
CREATE INDEX idx_moderation_log_actor   ON public.review_moderation_log (actor_user_id);
CREATE INDEX idx_moderation_log_created ON public.review_moderation_log (created_at DESC);

-- ── 5. RLS ──────────────────────────────────────────────────────────────

-- Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public: published reviews visible to everyone
CREATE POLICY reviews_select_published ON public.reviews
  FOR SELECT USING (status = 'published');

-- Author: can always see their own reviews (even hidden/flagged)
CREATE POLICY reviews_select_own ON public.reviews
  FOR SELECT USING (auth.uid() = user_id);

-- Admin: full read access
CREATE POLICY reviews_select_admin ON public.reviews
  FOR SELECT USING (is_campus_super_admin());

-- Manager: read reviews for listings in their campus scope
CREATE POLICY reviews_select_manager ON public.reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = reviews.listing_id
        AND is_manager_of_campus(listings.campus_id)
    )
  );

-- Authenticated users can insert their own review. The verification snapshot
-- must match the profile's actual school_verified value so a client cannot
-- self-assign verified status by writing school_verified_at_review_time=true.
CREATE POLICY reviews_insert_own ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND school_verified_at_review_time = (
      SELECT school_verified FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Author can update their own review
CREATE POLICY reviews_update_own ON public.reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Author can delete their own review
CREATE POLICY reviews_delete_own ON public.reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Admin can update any review
CREATE POLICY reviews_update_admin ON public.reviews
  FOR UPDATE USING (is_campus_super_admin());

-- Admin can delete any review
CREATE POLICY reviews_delete_admin ON public.reviews
  FOR DELETE USING (is_campus_super_admin());

-- Manager can update reviews for listings in their campus scope
CREATE POLICY reviews_update_manager ON public.reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = reviews.listing_id
        AND is_manager_of_campus(listings.campus_id)
    )
  );

-- Manager can delete reviews for listings in their campus scope
CREATE POLICY reviews_delete_manager ON public.reviews
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = reviews.listing_id
        AND is_manager_of_campus(listings.campus_id)
    )
  );

-- Column-level write control: authenticated users may only UPDATE rating/text
-- on their own reviews. school_verified_at_review_time, status, user_id,
-- listing_id and the author snapshots are locked so a client cannot
-- self-assign verification or tamper with moderation state.
REVOKE UPDATE ON public.reviews FROM anon, authenticated;
GRANT UPDATE (rating, text) ON public.reviews TO authenticated;

-- Review Likes
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

-- Anyone who can see a published review can see its like count
CREATE POLICY review_likes_select_published ON public.review_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reviews
      WHERE reviews.id = review_likes.review_id
        AND reviews.status = 'published'
    )
  );

-- Author can see their own likes (regardless of review status)
CREATE POLICY review_likes_select_own ON public.review_likes
  FOR SELECT USING (auth.uid() = user_id);

-- Authenticated users can like (insert their own)
CREATE POLICY review_likes_insert_own ON public.review_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove their own like
CREATE POLICY review_likes_delete_own ON public.review_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Review Replies
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

-- Published replies on published reviews visible to everyone
CREATE POLICY review_replies_select_published ON public.review_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reviews
      WHERE reviews.id = review_replies.review_id
        AND reviews.status = 'published'
    )
  );

-- Author can see their own replies (even on hidden reviews)
CREATE POLICY review_replies_select_own ON public.review_replies
  FOR SELECT USING (auth.uid() = user_id);

-- Admin can see all replies
CREATE POLICY review_replies_select_admin ON public.review_replies
  FOR SELECT USING (is_campus_super_admin());

-- Authenticated users can insert their own reply on a published review
CREATE POLICY review_replies_insert_own ON public.review_replies
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.reviews
      WHERE reviews.id = review_replies.review_id
        AND reviews.status = 'published'
    )
  );

-- Author can update their own reply
CREATE POLICY review_replies_update_own ON public.review_replies
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Author can delete their own reply
CREATE POLICY review_replies_delete_own ON public.review_replies
  FOR DELETE USING (auth.uid() = user_id);

-- Admin can update/delete any reply
CREATE POLICY review_replies_update_admin ON public.review_replies
  FOR UPDATE USING (is_campus_super_admin());

CREATE POLICY review_replies_delete_admin ON public.review_replies
  FOR DELETE USING (is_campus_super_admin());

-- Moderation Log (admin-only reads; writes go through service role)
ALTER TABLE public.review_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY moderation_log_select_admin ON public.review_moderation_log
  FOR SELECT USING (is_campus_super_admin());

COMMIT;
