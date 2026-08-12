-- Add is_featured flag to agents table.
-- When true, the agent's card receives the "Official Rumia Agent" premium
-- treatment on the public directory and is pinned to the top of the listing.
-- Admins can toggle this from /admin/agents without any code changes.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Index so the public directory sort (featured first) stays fast as agents grow
CREATE INDEX IF NOT EXISTS idx_agents_is_featured ON agents (is_featured);
