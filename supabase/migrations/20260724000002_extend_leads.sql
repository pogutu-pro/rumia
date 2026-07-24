-- Extend leads table to capture user contact info and flow type
-- These fields are populated when user completes the Contact flow
-- contact_type: 'hostel_owner' or 'rumia_agent'

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_type TEXT CHECK (
    contact_type IN ('hostel_owner', 'rumia_agent')
  );

-- Index for agent lead queries by contact type
CREATE INDEX IF NOT EXISTS idx_leads_contact_type
  ON leads (agent_id, contact_type, clicked_at DESC);
