"""Outcome-based ledger: money is recorded against confirmed outcomes, never against clicks.

Revision ID: 0006
Revises: 0005
"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ledger_entries (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            kind        text NOT NULL CHECK (kind IN ('move_in_fee', 'scout_bounty', 'listing_upgrade', 'assist_fee', 'adjustment', 'legacy_commission')),
            org_id      uuid REFERENCES lister_orgs(id) ON DELETE SET NULL,
            user_id     uuid,
            amount      numeric NOT NULL,
            currency    text NOT NULL DEFAULT 'KES',
            status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'void')),
            inquiry_id  uuid REFERENCES inquiries(id) ON DELETE SET NULL,
            property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
            note        text,
            created_by  uuid,
            created_at  timestamptz NOT NULL DEFAULT now(),
            paid_at     timestamptz
        )
        """
    )
    # One move-in fee per contact, however many times the outcome is reported.
    op.execute("CREATE UNIQUE INDEX uq_ledger_move_in ON ledger_entries (inquiry_id) WHERE kind = 'move_in_fee'")
    op.execute("CREATE INDEX idx_ledger_org ON ledger_entries (org_id, created_at DESC)")
    # Historical per-click commissions are carried over as read-only history.
    op.execute(
        """
        INSERT INTO ledger_entries (kind, amount, status, note, created_at, paid_at)
        SELECT 'legacy_commission', c.amount,
               CASE c.status WHEN 'paid' THEN 'paid' ELSE 'pending' END,
               'per-click commission before outcome-based billing', c.created_at, c.paid_at
        FROM commissions c
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ledger_entries")
