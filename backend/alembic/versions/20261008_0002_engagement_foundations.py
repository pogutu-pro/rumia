"""Engagement foundations: devices, first-party events, inquiries (reference codes), device saves.

Revision ID: 0002
Revises: 0001
"""
from datetime import date

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _month_start(d: date, add: int) -> date:
    idx = d.year * 12 + (d.month - 1) + add
    return date(idx // 12, idx % 12 + 1, 1)


def upgrade() -> None:
    # An anonymous browser, identified by a client-generated UUID. Bridges to a user after sign-in.
    op.execute(
        """
        CREATE TABLE devices (
            id          uuid PRIMARY KEY,
            user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
            first_seen  timestamptz NOT NULL DEFAULT now(),
            last_seen   timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_devices_user ON devices (user_id) WHERE user_id IS NOT NULL")

    # First-party behavioural events, partitioned by month so retention is a DROP of old partitions.
    op.execute(
        """
        CREATE TABLE events (
            id           uuid NOT NULL DEFAULT gen_random_uuid(),
            occurred_at  timestamptz NOT NULL,
            received_at  timestamptz NOT NULL DEFAULT now(),
            name         text NOT NULL,
            device_id    uuid,
            user_id      uuid,
            session_id   text,
            market       text,
            surface      text,
            referrer_kind text,
            listing_id   uuid,
            props        jsonb NOT NULL DEFAULT '{}'::jsonb,
            PRIMARY KEY (id, occurred_at)
        ) PARTITION BY RANGE (occurred_at)
        """
    )
    op.execute("CREATE INDEX idx_events_name_time ON events (name, occurred_at)")
    op.execute("CREATE INDEX idx_events_listing_time ON events (listing_id, occurred_at) WHERE listing_id IS NOT NULL")
    op.execute("CREATE INDEX idx_events_device_time ON events (device_id, occurred_at) WHERE device_id IS NOT NULL")
    op.execute("CREATE TABLE events_default PARTITION OF events DEFAULT")
    today = date.today()
    for offset in range(-1, 4):
        start, end = _month_start(today, offset), _month_start(today, offset + 1)
        op.execute(
            f"CREATE TABLE events_{start:%Y_%m} PARTITION OF events FOR VALUES FROM ('{start}') TO ('{end}')"
        )

    # A contact action. ref_code travels inside the WhatsApp message so replies can be attributed
    # without the seeker signing in.
    op.execute(
        """
        CREATE TABLE inquiries (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            ref_code      text NOT NULL,
            listing_id    uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            agent_id      uuid REFERENCES agents(id) ON DELETE SET NULL,
            channel       text NOT NULL CHECK (channel IN ('whatsapp', 'call')),
            device_id     uuid,
            user_id       uuid,
            session_id    text,
            source        text,
            created_at    timestamptz NOT NULL DEFAULT now(),
            replied       text CHECK (replied IN ('yes', 'no', 'not_yet')),
            replied_at    timestamptz,
            outcome       text CHECK (outcome IN ('moved_in', 'not_suitable', 'no_reply', 'unknown')),
            outcome_source text CHECK (outcome_source IN ('seeker', 'lister', 'ops')),
            outcome_at    timestamptz
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_inquiries_ref_code ON inquiries (ref_code)")
    op.execute("CREATE INDEX idx_inquiries_listing_time ON inquiries (listing_id, created_at DESC)")
    op.execute("CREATE INDEX idx_inquiries_agent_time ON inquiries (agent_id, created_at DESC)")
    op.execute("CREATE INDEX idx_inquiries_device ON inquiries (device_id) WHERE device_id IS NOT NULL")

    # Saves made without an account. Signed-in users keep using `wishlists`; device saves are merged
    # into it on sign-in.
    op.execute(
        """
        CREATE TABLE device_saves (
            device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
            listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            created_at  timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (device_id, listing_id)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS device_saves")
    op.execute("DROP TABLE IF EXISTS inquiries")
    op.execute("DROP TABLE IF EXISTS events")
    op.execute("DROP TABLE IF EXISTS devices")
