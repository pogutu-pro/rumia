-- Randomize the admin listing order.
--
-- "Reorder Listings" used to bulk-clear sort_position so the default
-- newest-first ordering (created_at DESC) applied. The public /hostels page
-- should instead show a freshly randomized line-up, so this RPC reassigns each
-- listing a unique random sort position (1..N). Positions are unique so the
-- fallback ORDER BY sort_position ASC NULLS LAST, created_at DESC never kicks
-- in on ties — the shuffled order is what appears everywhere.

CREATE OR REPLACE FUNCTION public.shuffle_listing_order(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT l.id,
           l.sort_position AS old_position,
           row_number() OVER (ORDER BY random())::integer AS new_position
    FROM listings l
  LOOP
    -- Audit old → new positions for the affected rows.
    INSERT INTO listing_sort_history (listing_id, admin_id, old_position, new_position)
    VALUES (m.id, p_admin_id, m.old_position, m.new_position);

    UPDATE listings
    SET sort_position = m.new_position
    WHERE id = m.id;
  END LOOP;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shuffle_listing_order(UUID) TO authenticated;
