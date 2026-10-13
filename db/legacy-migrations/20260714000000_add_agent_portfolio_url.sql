-- Add optional portfolio_url column to agents table
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
