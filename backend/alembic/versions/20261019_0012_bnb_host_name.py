"""RumiaBnB: the host's name shown to guests, set per listing.

The listing's agent can be a broker rather than the person who hosts, so the name on "Hosted by" is its own field.
Empty means the site's default host name. Additive: one nullable column.

Revision ID: 0012
Revises: 0011
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE bnb_details ADD COLUMN IF NOT EXISTS host_name text CHECK (host_name IS NULL OR length(host_name) <= 80)")


def downgrade() -> None:
    op.execute("ALTER TABLE bnb_details DROP COLUMN IF EXISTS host_name")
