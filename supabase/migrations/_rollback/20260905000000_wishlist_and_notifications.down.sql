-- 20260905000000_wishlist_and_notifications.down.sql
-- Down migration (manual-rollback documentation only, per repo convention).

-- 5. Drop wishlist_notification_events
DROP TABLE IF EXISTS wishlist_notification_events;

-- 4. Drop email_deliveries
DROP TABLE IF EXISTS email_deliveries;

-- 3. Drop notification_preferences + trigger
DROP TRIGGER IF EXISTS trg_ensure_notification_preferences ON profiles;
DROP FUNCTION IF EXISTS public.ensure_notification_preferences();
DROP TABLE IF EXISTS notification_preferences;

-- 2. app_notifications type column
ALTER TABLE app_notifications DROP COLUMN IF EXISTS type;

-- 1. wishlists → saved_hostels (reverse rename)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_hostels'
  ) THEN
    ALTER TABLE wishlists RENAME TO saved_hostels;
  END IF;
END $$;
