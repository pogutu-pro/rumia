"""Host invites: a one-time link that hands a team-managed RumiaBnB host's organisation to the real owner.

Staff create a host's listings for them (onboarding in person); when the owner wants their own login, staff send an
invite link. Opening it while signed in makes that account an owner of the organisation. Only a hash of the token is
stored. Additive: one new table.

Revision ID: 0011
Revises: 0010
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE host_invites (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id      uuid NOT NULL REFERENCES lister_orgs(id) ON DELETE CASCADE,
            token_hash  text NOT NULL UNIQUE,
            created_by  uuid,
            created_at  timestamptz NOT NULL DEFAULT now(),
            expires_at  timestamptz NOT NULL,
            used_at     timestamptz,
            used_by     uuid
        )
        """
    )
    op.execute("CREATE INDEX idx_host_invites_org ON host_invites (org_id, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS host_invites")
