-- 20260810000001_repair_degraded_profile_saves.sql
-- Repair profiles that were affected by the "unknown column retry" bug.
--
-- During the Aug 9 rollout, the deployed client wrote `home_campus_id` /
-- `home_campus_name` / `home_campus_confirmed_at` before the live database
-- had those columns, so the retry path silently saved only `phone`. Those
-- users were left stuck in the profile-completion gate forever.
--
-- Target rows: a phone was saved (so the update clearly succeeded) but none of
-- the campus fields were written, and the trigger had already stamped
-- `campus_id`. We backfill the home-campus confirmation from those saved
-- values so the completion gate clears.
UPDATE profiles
SET
  home_campus_id = p.campus_id,
  home_campus_name = c.name,
  home_campus_confirmed_at = p.updated_at
FROM (
  SELECT id, campus_id, updated_at
  FROM profiles
  WHERE phone IS NOT NULL
    AND phone <> ''
    AND home_campus_id IS NULL
    AND home_campus_name IS NULL
    AND home_campus_confirmed_at IS NULL
    AND campus_id IS NOT NULL
) p
JOIN campuses c ON c.id = p.campus_id
WHERE profiles.id = p.id;