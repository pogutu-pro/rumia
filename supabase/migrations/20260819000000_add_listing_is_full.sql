-- Add is_full column to listings.
-- When true, the hostel is fully occupied: the owner contact is hidden from
-- public pages and visitors are directed to the Rumia agent for alternatives.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_full BOOLEAN DEFAULT false;

-- Agent can toggle is_full on their own listings (same policy as update_own)
-- The existing listings_update_own and listings_update_commission_own policies
-- already allow agents to UPDATE their own rows, so no new policy needed.

-- Manager can toggle is_full via supabaseAdmin (bypasses RLS).
-- Admin can toggle is_full via supabaseAdmin (bypasses RLS).
