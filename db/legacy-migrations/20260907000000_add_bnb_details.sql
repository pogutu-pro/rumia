-- RumiaBnB: short-stay listing details
-- The listings table already carries: title, description, location, area, county,
-- lat/lng, amenities (TEXT[]), listing_images, agent_id, property_type, price,
-- is_active. This table holds BnB-specific fields only.

CREATE TABLE IF NOT EXISTS bnb_details (
  listing_id        UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,

  -- Property classification
  listing_type      TEXT NOT NULL DEFAULT 'entire_place'
                    CHECK (listing_type IN ('entire_place', 'private_room', 'shared_space')),

  -- Capacity
  max_guests        INTEGER,
  bedrooms          INTEGER,
  bathrooms         INTEGER,
  -- [{type: "Queen", qty: 1}, {type: "Single", qty: 2}]
  bed_config        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Pricing
  price_unit        TEXT NOT NULL DEFAULT 'night'
                    CHECK (price_unit IN ('night', 'week', 'month')),
  min_stay_nights   INTEGER NOT NULL DEFAULT 1,
  max_stay_nights   INTEGER,
  cleaning_fee      NUMERIC,
  security_deposit  NUMERIC,
  extra_guest_fee   NUMERIC,

  -- Availability
  available_from    DATE,
  available_until   DATE,
  check_in_time     TEXT,
  check_out_time    TEXT,
  advance_notice_hours INTEGER,

  -- Rules & suitability
  -- {smoking: false, pets: false, parties: false, visitors: false,
  --  children: true, quiet_hours: "22:00-07:00"}
  house_rules       JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_rules      TEXT,
  -- ['students', 'families', 'tourists', 'business', 'couples', 'groups']
  guest_suitability TEXT[] NOT NULL DEFAULT '{}',

  -- Location detail
  nearby_landmark   TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

-- Index for agent dashboard queries (join listings → bnb_details)
CREATE INDEX IF NOT EXISTS idx_bnb_details_listing_id ON bnb_details (listing_id);

COMMENT ON TABLE bnb_details IS
  'RumiaBnB-specific metadata for listings with property_type = ''short_stay''.';
