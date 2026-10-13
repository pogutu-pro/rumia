-- 20260905000000_wishlist_and_notifications.sql
-- Wishlist rename + centralized notification system data model.
--
-- 1. Renames saved_hostels → wishlists (pure DDL, preserves data + RLS + indexes)
-- 2. Adds a `type` column to app_notifications (aligns ORM with existing `body/url/is_read`).
-- 3. Creates notification_preferences (per-user channel opt-in; wishlist consent is separate).
-- 4. Creates email_deliveries (Brevo delivery tracking, provider message id, status).
-- 5. Creates wishlist_notification_events (idempotency/dedup for event-driven wishlist alerts).
--
-- Additive + idempotent. Rollback not automatic (see _rollback/).

BEGIN;

-- ── 1. saved_hostels → wishlists ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlists'
  ) THEN
    ALTER TABLE saved_hostels RENAME TO wishlists;
  END IF;
END $$;

-- Rename/backfill indexes when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_saved_hostels_user'
  ) THEN
    ALTER INDEX idx_saved_hostels_user RENAME TO idx_wishlists_user;
  END IF;
END $$;

-- Recreate RLS policies on the renamed table (idempotent)
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlists_select_own" ON wishlists;
CREATE POLICY "wishlists_select_own"
  ON wishlists FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "wishlists_insert_own" ON wishlists;
CREATE POLICY "wishlists_insert_own"
  ON wishlists FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "wishlists_delete_own" ON wishlists;
CREATE POLICY "wishlists_delete_own"
  ON wishlists FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Drop legacy saved_hostels policies if any remain (they no longer resolve)
DROP POLICY IF EXISTS "saved_hostels_select_own" ON wishlists;
DROP POLICY IF EXISTS "saved_hostels_insert_own" ON wishlists;
DROP POLICY IF EXISTS "saved_hostels_delete_own" ON wishlists;

-- Efficient reverse query: listing_id → how many users wishlisted it
CREATE INDEX IF NOT EXISTS idx_wishlists_listing
  ON wishlists (listing_id);

-- ── 2. app_notifications: align ORM with existing DB schema ─────────────────
-- DB already has: id, user_id, title, body, url, is_read, created_at
-- ORM expects:    id, user_id, title, message, type, read, created_at
-- We keep DB as source of truth and ADD the `type` column that the ORM uses;
-- the ORM will map body→message, url, is_read→read.
ALTER TABLE app_notifications
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';

CREATE INDEX IF NOT EXISTS idx_app_notifications_unread
  ON app_notifications (user_id) WHERE is_read = false;

-- ── 3. notification_preferences ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Wishlist-specific channel opt-in. Wishlist MEMBERSHIP is separate from
  -- notification CONSENT: a user can wishlist a hostel with channels disabled.
  wishlist_push_enabled BOOLEAN NOT NULL DEFAULT true,
  wishlist_email_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a preferences row whenever a profile is created
CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_notification_preferences ON profiles;
CREATE TRIGGER trg_ensure_notification_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_notification_preferences();

-- Backfill for existing profiles
INSERT INTO notification_preferences (user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own preferences; service role manages all.
DROP POLICY IF EXISTS "notification_preferences_select_own" ON notification_preferences;
CREATE POLICY "notification_preferences_select_own"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_update_own" ON notification_preferences;
CREATE POLICY "notification_preferences_update_own"
  ON notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_service_all" ON notification_preferences;
CREATE POLICY "notification_preferences_service_all"
  ON notification_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 4. email_deliveries (Brevo delivery tracking) ────────────────────────────
CREATE TABLE IF NOT EXISTS email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'bounced', 'blocked', 'deferred', 'failed', 'cancelled')),
  provider TEXT NOT NULL DEFAULT 'brevo',
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  -- Event context for rendering (e.g. {old_price, new_price, summary}) so
  -- workers never need to re-query listing state at send time.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_user
  ON email_deliveries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_status
  ON email_deliveries (status)
  WHERE status IN ('pending', 'sending', 'deferred', 'failed');

CREATE INDEX IF NOT EXISTS idx_email_deliveries_listing
  ON email_deliveries (listing_id)
  WHERE listing_id IS NOT NULL;

CREATE OR REPLACE TRIGGER email_deliveries_updated_at
  BEFORE UPDATE ON email_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (delivery rows are server-managed); users
-- should not need direct SQL access since they consume via /notifications API.
DROP POLICY IF EXISTS "email_deliveries_service_all" ON email_deliveries;
CREATE POLICY "email_deliveries_service_all"
  ON email_deliveries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 4b. push_deliveries (per-device push delivery tracking) ─────────────────
CREATE TABLE IF NOT EXISTS push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('web_push', 'expo_push')),
  token_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'skipped', 'cancelled')),
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  -- {title, body, url, type} as dispatched; used by retry workers.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_user
  ON push_deliveries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_status
  ON push_deliveries (status)
  WHERE status IN ('pending', 'sending', 'failed');

ALTER TABLE push_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_deliveries_service_all" ON push_deliveries;
CREATE POLICY "push_deliveries_service_all"
  ON push_deliveries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 5. wishlist_notification_events (idempotency / dedup) ───────────────────
-- One row per (wishlist_user, listing, notification_type) per dispatch window.
-- Prevents a landlord toggling availability repeatedly from spamming users.
CREATE TABLE IF NOT EXISTS wishlist_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup: has this user already been notified for this listing+type recently?
CREATE INDEX IF NOT EXISTS idx_wishlist_events_dedup
  ON wishlist_notification_events (user_id, listing_id, notification_type, created_at DESC);

ALTER TABLE wishlist_notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlist_events_service_all" ON wishlist_notification_events;
CREATE POLICY "wishlist_events_service_all"
  ON wishlist_notification_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
