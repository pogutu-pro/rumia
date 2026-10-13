-- ── Customer Support Team on the /verify (Hakikisha) page ────────────────
-- Agents shown on the Hakikisha page are curated by the admin:
--   is_support   → appears in the customer-support section on /verify
--   support_rank → admin-set ordering (lower = higher up)
--   is_owner     → the platform owner / main support (unique hero card),
--                  at most one agent can have this flag
--
-- is_owner is independent of verified: the platform owner can show as main
-- support even before their official records are fully verified.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS is_support BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_rank INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- At most one platform owner (partial unique index on constant expression)
CREATE UNIQUE INDEX IF NOT EXISTS agents_single_owner
  ON agents ((1))
  WHERE is_owner;

-- Fast sort for the support section on /verify
CREATE INDEX IF NOT EXISTS idx_agents_support_team
  ON agents (is_support, support_rank) WHERE is_support;