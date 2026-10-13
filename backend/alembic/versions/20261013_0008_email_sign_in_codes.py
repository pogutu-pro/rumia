"""One-time email codes for sign-in (sent through Brevo).

Only a hash of the code is stored. Rows expire after 10 minutes, allow 5 wrong guesses, and are single-use.
Additive: a new table, nothing else is touched.

Revision ID: 0008
Revises: 0007
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.auth_email_codes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            email text NOT NULL,
            code_hash text NOT NULL,
            attempts integer NOT NULL DEFAULT 0,
            expires_at timestamptz NOT NULL,
            used_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS auth_email_codes_email_idx ON public.auth_email_codes (email, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.auth_email_codes")
