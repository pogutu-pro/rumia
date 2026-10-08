"""Geography: markets, places, landmarks (replacing campus/zone as the way a town is described).

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE markets (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            slug       text NOT NULL UNIQUE,
            name       text NOT NULL,
            status     text NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden', 'pilot', 'live', 'paused')),
            center_lat numeric(10, 7),
            center_lng numeric(10, 7),
            config     jsonb NOT NULL DEFAULT '{}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE places (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            market_id  uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
            parent_id  uuid REFERENCES places(id) ON DELETE SET NULL,
            kind       text NOT NULL CHECK (kind IN ('county', 'town', 'neighbourhood')),
            name       text NOT NULL,
            slug       text NOT NULL,
            aliases    text[] NOT NULL DEFAULT '{}',
            lat        numeric(10, 7),
            lng        numeric(10, 7),
            legacy_zone_id uuid,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (market_id, slug)
        )
        """
    )
    op.execute("CREATE INDEX idx_places_market_kind ON places (market_id, kind)")
    op.execute(
        """
        CREATE TABLE landmarks (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            market_id  uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
            kind       text NOT NULL CHECK (kind IN ('university', 'college', 'hospital', 'cbd', 'transport', 'other')),
            name       text NOT NULL,
            slug       text NOT NULL,
            aliases    text[] NOT NULL DEFAULT '{}',
            lat        numeric(10, 7) NOT NULL,
            lng        numeric(10, 7) NOT NULL,
            features   jsonb NOT NULL DEFAULT '{}'::jsonb,
            legacy_campus_id uuid,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (market_id, slug)
        )
        """
    )

    # Listings point at the market and place they belong to. Existing columns (campus_id, county,
    # area, zone_id) stay until the contract phase.
    op.execute("ALTER TABLE listings ADD COLUMN market_id uuid REFERENCES markets(id)")
    op.execute("ALTER TABLE listings ADD COLUMN place_id uuid REFERENCES places(id)")
    op.execute("CREATE INDEX idx_listings_market_place ON listings (market_id, place_id) WHERE is_active")

    # ── Seed the first market from what the platform already knows ───────────────────────────────
    # Nyeri: centre of town. Neighbourhoods come from the existing campus zones of Nyeri campuses.
    op.execute(
        """
        INSERT INTO markets (slug, name, status, center_lat, center_lng, config)
        VALUES ('nyeri', 'Nyeri', 'live', -0.4197000, 36.9510000,
                '{"reconfirm_after_days": 10, "stale_after_days": 14, "pause_after_days": 21}'::jsonb)
        """
    )
    op.execute(
        """
        INSERT INTO places (market_id, kind, name, slug, legacy_zone_id)
        SELECT DISTINCT ON (lower(z.slug))
               (SELECT id FROM markets WHERE slug = 'nyeri'), 'neighbourhood', z.name,
               regexp_replace(regexp_replace(lower(z.slug), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'), z.id
        FROM campus_zones z JOIN campuses c ON c.id = z.campus_id
        WHERE lower(c.city) = 'nyeri'
        ORDER BY lower(z.slug), z.created_at
        ON CONFLICT (market_id, slug) DO NOTHING
        """
    )
    # Universities become landmarks (coordinates for DeKUT are the ones already used by the map code).
    op.execute(
        """
        INSERT INTO landmarks (market_id, kind, name, slug, lat, lng, features, legacy_campus_id)
        SELECT (SELECT id FROM markets WHERE slug = 'nyeri'), 'university', c.name, c.slug,
               -0.3946000, 36.9635000,
               CASE WHEN c.slug = 'dekut'
                    THEN '{"school_email_domain": "dkut.ac.ke", "official_registry": "dekut"}'::jsonb
                    ELSE '{}'::jsonb END,
               c.id
        FROM campuses c WHERE c.slug = 'dekut'
        """
    )
    op.execute(
        """
        INSERT INTO landmarks (market_id, kind, name, slug, lat, lng, aliases)
        VALUES ((SELECT id FROM markets WHERE slug = 'nyeri'), 'cbd', 'Nyeri town centre', 'nyeri-cbd',
                -0.4197000, 36.9510000, ARRAY['town', 'cbd', 'nyeri town'])
        """
    )

    # Backfill listings: market from the campus city, place from the zone, else from the area name.
    op.execute(
        """
        UPDATE listings l SET market_id = m.id
        FROM markets m
        WHERE m.slug = 'nyeri' AND (lower(coalesce(l.county, '')) = 'nyeri'
              OR l.campus_id IN (SELECT id FROM campuses WHERE lower(city) = 'nyeri'))
        """
    )
    op.execute(
        """
        UPDATE listings l SET place_id = p.id
        FROM places p
        WHERE l.market_id = p.market_id AND l.zone_id IS NOT NULL AND p.legacy_zone_id = l.zone_id
        """
    )
    op.execute(
        """
        UPDATE listings l SET place_id = p.id
        FROM places p
        WHERE l.place_id IS NULL AND l.market_id = p.market_id AND l.area IS NOT NULL
          AND p.slug = regexp_replace(regexp_replace(lower(l.area), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_listings_market_place")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS place_id")
    op.execute("ALTER TABLE listings DROP COLUMN IF EXISTS market_id")
    op.execute("DROP TABLE IF EXISTS landmarks")
    op.execute("DROP TABLE IF EXISTS places")
    op.execute("DROP TABLE IF EXISTS markets")
