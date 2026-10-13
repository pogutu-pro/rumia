-- Efficient listing ordering:
--
-- 1. New listings are pinned to the top (sort_position = 0) so freshly created
--    hostels appear first on the public /hostels page without any admin work.
-- 2. "Reorder Listings" (admin reset) bulk-clears sort_position so the default
--    newest-first ordering (created_at DESC) applies.
-- 3. Manual drag-and-drop ordering is applied with a single set-based UPDATE via
--    reorder_listings() instead of one UPDATE per listing.
--
-- Ordering everywhere is: ORDER BY sort_position ASC NULLS LAST, created_at DESC,
-- which is served by the indexes below (no client-side re-sorting required).

-- ── 1. New listings land at the top ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_new_listing_sort_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sort_position IS NULL THEN
    NEW.sort_position := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listings_new_top ON listings;
CREATE TRIGGER trg_listings_new_top
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_new_listing_sort_position();

-- ── 2. Bulk set-listings order (admin manual drag-and-drop save) ────────────

CREATE OR REPLACE FUNCTION public.reorder_listings(
  p_positions JSONB,
  p_admin_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Audit old → new positions for the affected rows.
  INSERT INTO listing_sort_history (listing_id, admin_id, old_position, new_position)
  SELECT t.listing_id, p_admin_id, l.sort_position, t.new_position
  FROM jsonb_to_recordset(p_positions)
    AS t(listing_id uuid, new_position integer)
  LEFT JOIN listings l ON l.id = t.listing_id;

  -- Single set-based UPDATE: atomic, no partial reordering.
  UPDATE listings l
  SET sort_position = t.new_position
  FROM jsonb_to_recordset(p_positions)
    AS t(listing_id uuid, new_position integer)
  WHERE l.id = t.listing_id;

  RETURN TRUE;
END;
$$;

-- ── 3. Reset to default newest-first ordering ────────────────────────────────

CREATE OR REPLACE FUNCTION public.reset_listing_order(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO listing_sort_history (listing_id, admin_id, old_position, new_position)
  SELECT id, p_admin_id, sort_position, NULL
  FROM listings
  WHERE sort_position IS NOT NULL;

  UPDATE listings SET sort_position = NULL WHERE sort_position IS NOT NULL;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_listings(JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_listing_order(UUID) TO authenticated;

-- ── 4. Index for the public /hostels ordering query ─────────────────────────
-- WHERE is_active = true ORDER BY sort_position ASC NULLS LAST, created_at DESC

CREATE INDEX IF NOT EXISTS idx_listings_active_sort
  ON public.listings (sort_position ASC NULLS LAST, created_at DESC)
  WHERE is_active;
