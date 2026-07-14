-- Separate Founder badge from Official (is_featured) badge.
-- is_featured  → "Official Rumia Agent" (vetted, quality-assured)
-- is_founder   → "Founder" (earliest / founding agents of the platform)
-- Both are independently toggled by admin from /admin/agents.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT false;

-- Index for directory sort (founder agents may be pinned separately)
CREATE INDEX IF NOT EXISTS idx_agents_is_founder ON agents (is_founder);
