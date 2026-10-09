"""Baseline: the schema as it exists after the 2026-10-01 cutover.

This revision is intentionally empty. It stands for everything created by supabase/migrations/*.sql
(and by the live database). Existing databases are marked with `alembic stamp 0001`; new environments
are built with scripts/db-replay-migrations.sh and then stamped the same way. Every schema change
after this point is an Alembic revision.

Revision ID: 0001
Revises:
"""

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
