DROP TRIGGER IF EXISTS trg_listings_new_top ON listings;
DROP FUNCTION IF EXISTS public.set_new_listing_sort_position();
DROP FUNCTION IF EXISTS public.reorder_listings(JSONB, UUID);
DROP FUNCTION IF EXISTS public.reset_listing_order(UUID);
DROP INDEX IF EXISTS idx_listings_active_sort;
