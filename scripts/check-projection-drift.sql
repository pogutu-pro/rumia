-- Read-only drift check between the legacy `listings` model (still the write path) and its copy in
-- the new `properties` / `property_units` model. Every row returned is a disagreement; zero rows = in sync.
--   psql "$DATABASE_URL" -f scripts/check-projection-drift.sql
-- Columns: check_name, listing_id, detail
WITH l AS (
  SELECT l.*, p.id AS prop_id, p.name AS p_name, p.slug AS p_slug, p.status AS p_status, p.org_id AS p_org
  FROM listings l LEFT JOIN properties p ON p.legacy_listing_id = l.id
),
units AS (
  SELECT property_id, count(*) AS n, min(price_amount) AS min_price
  FROM property_units GROUP BY property_id
),
imgs AS (SELECT listing_id, count(*) AS n FROM listing_images GROUP BY listing_id),
media AS (
  SELECT p.legacy_listing_id AS listing_id, count(*) AS n
  FROM property_media pm JOIN properties p ON p.id = pm.property_id GROUP BY 1
)
SELECT 'no_property_copy' AS check_name, l.id AS listing_id, l.title AS detail
  FROM l WHERE prop_id IS NULL
UNION ALL
SELECT 'name_differs', l.id, l.title || '  <>  ' || l.p_name
  FROM l WHERE prop_id IS NOT NULL AND l.title IS DISTINCT FROM l.p_name
UNION ALL
SELECT 'slug_differs', l.id, coalesce(l.slug, '(null)') || '  <>  ' || l.p_slug
  FROM l WHERE prop_id IS NOT NULL AND l.slug IS NOT NULL AND l.slug <> l.p_slug
UNION ALL
SELECT 'inactive_but_not_paused', l.id, 'is_active=false, property status=' || l.p_status
  FROM l WHERE prop_id IS NOT NULL AND NOT coalesce(l.is_active, true)
    AND l.p_status NOT IN ('paused', 'removed', 'archived', 'let', 'draft')
UNION ALL
SELECT 'active_but_not_live', l.id, 'is_active=true, property status=' || l.p_status
  FROM l WHERE prop_id IS NOT NULL AND coalesce(l.is_active, true)
    AND l.p_status NOT IN ('live', 'stale', 'in_review', 'let')
UNION ALL
SELECT 'full_but_units_available', l.id, 'is_full=true yet a unit has count_available>0'
  FROM l WHERE prop_id IS NOT NULL AND coalesce(l.is_full, false)
    AND EXISTS (SELECT 1 FROM property_units u WHERE u.property_id = l.prop_id AND u.count_available > 0)
UNION ALL
SELECT 'no_units', l.id, l.title
  FROM l LEFT JOIN units u ON u.property_id = l.prop_id WHERE prop_id IS NOT NULL AND u.n IS NULL
UNION ALL
SELECT 'cheapest_price_differs', l.id, 'listing price ' || l.price || ' vs cheapest unit ' || u.min_price
  FROM l JOIN units u ON u.property_id = l.prop_id
  WHERE l.price IS NOT NULL AND l.price > 0 AND u.min_price IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM listing_room_types rt WHERE rt.listing_id = l.id)
    AND l.price <> u.min_price
UNION ALL
SELECT 'images_not_copied', l.id, coalesce(i.n, 0) || ' legacy images vs ' || coalesce(m.n, 0) || ' media rows'
  FROM l LEFT JOIN imgs i ON i.listing_id = l.id LEFT JOIN media m ON m.listing_id = l.id
  WHERE prop_id IS NOT NULL AND coalesce(i.n, 0) <> coalesce(m.n, 0)
UNION ALL
SELECT 'wrong_org', l.id, 'property org does not belong to listing agent'
  FROM l WHERE prop_id IS NOT NULL AND l.agent_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM lister_orgs o WHERE o.id = l.p_org AND o.legacy_agent_id = l.agent_id)
UNION ALL
SELECT 'orphan_property', p.id, p.name
  FROM properties p WHERE p.legacy_listing_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM listings x WHERE x.id = p.legacy_listing_id)
ORDER BY 1, 2;
