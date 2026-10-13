"""Email + password sign-in: a credentials table, and a pending password on email codes.

A password is only stored once the emailed code proves the address is theirs (sign-up and forgot-password both
go through the code), so nobody can claim an address they do not own. Additive: nothing existing is changed.

Revision ID: 0009
Revises: 0008
"""
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.auth_credentials (
            user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            password_hash text NOT NULL,
            failed_attempts integer NOT NULL DEFAULT 0,
            locked_until timestamptz,
            updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("ALTER TABLE public.auth_email_codes ADD COLUMN IF NOT EXISTS pending_password_hash text")


def downgrade() -> None:
    op.execute("ALTER TABLE public.auth_email_codes DROP COLUMN IF EXISTS pending_password_hash")
    op.execute("DROP TABLE IF EXISTS public.auth_credentials")
