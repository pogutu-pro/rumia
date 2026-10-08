"""Discovery: trigram search index and saved searches (alerts).

Revision ID: 0005
Revises: 0004
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # Short display name for cards and reason chips ("8 min walk to DeKUT").
    op.execute("UPDATE landmarks SET features = features || '{\"short_name\": \"DeKUT\"}'::jsonb WHERE slug = 'dekut'")
    op.execute("CREATE INDEX idx_properties_name_trgm ON properties USING gin (name gin_trgm_ops)")
    op.execute("CREATE INDEX idx_places_name_trgm ON places USING gin (name gin_trgm_ops)")
    op.execute(
        """
        CREATE TABLE saved_searches (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            device_id        uuid,
            user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
            intent           jsonb NOT NULL,
            label            text,
            channel          text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
            email            text,
            phone            text,
            frequency        text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('instant', 'daily', 'weekly')),
            active           boolean NOT NULL DEFAULT true,
            last_notified_at timestamptz NOT NULL DEFAULT now(),
            created_at       timestamptz NOT NULL DEFAULT now(),
            CHECK (device_id IS NOT NULL OR user_id IS NOT NULL),
            CHECK ((channel = 'email' AND email IS NOT NULL) OR (channel = 'whatsapp' AND phone IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX idx_saved_searches_active ON saved_searches (active, last_notified_at) WHERE active")
    op.execute("CREATE INDEX idx_saved_searches_owner ON saved_searches (user_id, device_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS saved_searches")
    op.execute("DROP INDEX IF EXISTS idx_places_name_trgm")
    op.execute("DROP INDEX IF EXISTS idx_properties_name_trgm")
