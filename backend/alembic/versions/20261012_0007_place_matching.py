"""Match a listing's area to a place when the area has an apostrophe (King'ong'o -> kingongo).

`project_listing` looked the place up by slugifying the area, which turned "King'ong'o" into `king-ong-o`; the place is
`kingongo`, so those listings never got a place and were missing from place pages. The function now drops apostrophes
before slugifying (the web and the API build URLs the same way), and listings that were left without a place are
projected again. Additive: nothing is dropped, and the function is only edited in place.

Revision ID: 0007
Revises: 0006
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

OLD = "regexp_replace(lower(coalesce(l.area, '')), '[^a-z0-9]+', '-', 'g')"
NEW = "regexp_replace(replace(replace(lower(coalesce(l.area, '')), '''', ''), chr(8217), ''), '[^a-z0-9]+', '-', 'g')"


def _rewrite(old: str, new: str) -> None:
    conn = op.get_bind()
    definition = conn.exec_driver_sql("SELECT pg_get_functiondef('project_listing(uuid)'::regprocedure)").scalar_one()
    if old not in definition:
        raise RuntimeError("project_listing no longer has the expected area lookup; refusing to guess")
    conn.exec_driver_sql(definition.replace(old, new))


def upgrade() -> None:
    _rewrite(OLD, NEW)
    # Listings that never got a place: project them again so both models agree. Idempotent.
    op.execute("SELECT project_listing(id) FROM listings WHERE place_id IS NULL AND is_active")


def downgrade() -> None:
    _rewrite(NEW, OLD)
