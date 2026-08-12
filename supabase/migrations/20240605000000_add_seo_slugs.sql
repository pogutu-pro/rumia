-- Add SEO slugs to listings and agents

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS county TEXT DEFAULT 'nyeri',
  ADD COLUMN IF NOT EXISTS area TEXT DEFAULT 'dekut',
  ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'Self Contained',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Unique constraint so slugs can never collide
CREATE UNIQUE INDEX IF NOT EXISTS listings_slug_unique ON listings (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agents_slug_unique ON agents (slug) WHERE slug IS NOT NULL;

-- Back-fill slugs for existing listings from title
UPDATE listings
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
) || '-dekut'
WHERE slug IS NULL;

-- Back-fill slugs for existing agents from name
UPDATE agents
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
