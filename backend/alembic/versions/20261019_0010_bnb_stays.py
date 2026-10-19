"""RumiaBnB stays: attribution on contacts, booking requests with an audit trail, host fee agreements, the stay fee.

* `bnb_details`: optional weekly and monthly rates (the owner decides what a longer stay costs).
* `inquiries`: which product the contact came from, who handles it (the host or the RumiaBnB concierge), the campaign
  that brought the guest (UTM) and what they said when asked where they heard about us. A concierge chat may start
  before a place is chosen, so `listing_id` becomes optional. New channel `request` (a booking request on the site).
* `stay_requests`: dates, guests, the price quoted and agreed, status, and the guest's and host's reports of whether
  the stay happened. Snapshots the title and organisation so the record survives the listing.
* `stay_request_events`: every status change, who made it and when (for disputes).
* `host_agreements`: each host's fee terms over time.
* `ledger_entries`: kind `stay_fee`, at most one per stay request.

Additive: no data is changed or removed; widened CHECK constraints accept every existing row.

Revision ID: 0010
Revises: 0009
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE bnb_details
          ADD COLUMN IF NOT EXISTS weekly_price numeric CHECK (weekly_price IS NULL OR weekly_price > 0),
          ADD COLUMN IF NOT EXISTS monthly_price numeric CHECK (monthly_price IS NULL OR monthly_price > 0)
        """
    )

    op.execute(
        """
        ALTER TABLE inquiries
          ADD COLUMN IF NOT EXISTS product text NOT NULL DEFAULT 'rumia' CHECK (product IN ('rumia', 'bnb')),
          ADD COLUMN IF NOT EXISTS handled_by text NOT NULL DEFAULT 'host' CHECK (handled_by IN ('host', 'concierge')),
          ADD COLUMN IF NOT EXISTS utm_source text,
          ADD COLUMN IF NOT EXISTS utm_medium text,
          ADD COLUMN IF NOT EXISTS utm_campaign text,
          ADD COLUMN IF NOT EXISTS utm_content text,
          ADD COLUMN IF NOT EXISTS landing_path text,
          ADD COLUMN IF NOT EXISTS heard_from text
        """
    )
    op.execute("ALTER TABLE inquiries ALTER COLUMN listing_id DROP NOT NULL")
    op.execute("ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_channel_check")
    op.execute("ALTER TABLE inquiries ADD CONSTRAINT inquiries_channel_check CHECK (channel IN ('whatsapp', 'call', 'request'))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inquiries_product_time ON inquiries (product, created_at DESC)")

    op.execute(
        """
        CREATE TABLE stay_requests (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            inquiry_id        uuid UNIQUE REFERENCES inquiries(id) ON DELETE SET NULL,
            listing_id        uuid REFERENCES listings(id) ON DELETE SET NULL,
            org_id            uuid REFERENCES lister_orgs(id) ON DELETE SET NULL,
            listing_title     text NOT NULL,
            origin            text NOT NULL CHECK (origin IN ('guest', 'concierge')),
            guest_name        text NOT NULL,
            guest_phone       text NOT NULL,
            guest_email       text,
            guests            int NOT NULL CHECK (guests BETWEEN 1 AND 50),
            check_in          date NOT NULL,
            check_out         date NOT NULL,
            nights            int GENERATED ALWAYS AS (check_out - check_in) STORED,
            rate_basis        text NOT NULL CHECK (rate_basis IN ('night', 'week', 'month')),
            quoted_total      numeric NOT NULL CHECK (quoted_total >= 0),
            agreed_total      numeric CHECK (agreed_total IS NULL OR agreed_total >= 0),
            cleaning_fee      numeric CHECK (cleaning_fee IS NULL OR cleaning_fee >= 0),
            status            text NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show', 'disputed')),
            guest_note        text,
            host_note         text,
            guest_report      text CHECK (guest_report IN ('stayed', 'did_not_stay')),
            guest_reported_at timestamptz,
            host_report       text CHECK (host_report IN ('stayed', 'did_not_stay')),
            host_reported_at  timestamptz,
            access_token_hash text NOT NULL UNIQUE,
            created_by        uuid,
            created_at        timestamptz NOT NULL DEFAULT now(),
            updated_at        timestamptz NOT NULL DEFAULT now(),
            confirmed_at      timestamptz,
            closed_at         timestamptz,
            CHECK (check_out > check_in)
        )
        """
    )
    op.execute("CREATE INDEX idx_stay_requests_org_time ON stay_requests (org_id, created_at DESC)")
    op.execute("CREATE INDEX idx_stay_requests_status ON stay_requests (status, check_in)")
    op.execute("CREATE INDEX idx_stay_requests_listing_dates ON stay_requests (listing_id, check_in, check_out)")

    op.execute(
        """
        CREATE TABLE stay_request_events (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            stay_request_id  uuid NOT NULL REFERENCES stay_requests(id) ON DELETE CASCADE,
            at               timestamptz NOT NULL DEFAULT now(),
            actor            text NOT NULL CHECK (actor IN ('guest', 'host', 'staff', 'system')),
            actor_user_id    uuid,
            action           text NOT NULL,
            from_status      text,
            to_status        text,
            note             text
        )
        """
    )
    op.execute("CREATE INDEX idx_stay_request_events_req ON stay_request_events (stay_request_id, at)")

    op.execute(
        """
        CREATE TABLE host_agreements (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id          uuid NOT NULL REFERENCES lister_orgs(id) ON DELETE CASCADE,
            fee_percent     numeric(5, 2) NOT NULL CHECK (fee_percent >= 0 AND fee_percent <= 100),
            fee_min         numeric NOT NULL DEFAULT 0 CHECK (fee_min >= 0),
            fee_night_cap   int CHECK (fee_night_cap IS NULL OR fee_night_cap > 0),
            effective_from  date NOT NULL DEFAULT current_date,
            effective_to    date,
            note            text,
            created_by      uuid,
            created_at      timestamptz NOT NULL DEFAULT now(),
            CHECK (effective_to IS NULL OR effective_to >= effective_from)
        )
        """
    )
    op.execute("CREATE INDEX idx_host_agreements_org ON host_agreements (org_id, effective_from DESC)")

    op.execute("ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS stay_request_id uuid REFERENCES stay_requests(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_kind_check")
    op.execute(
        "ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN "
        "('move_in_fee', 'scout_bounty', 'listing_upgrade', 'assist_fee', 'adjustment', 'legacy_commission', 'stay_fee'))"
    )
    # One stay fee per stay, however many times the stay is reported.
    op.execute("CREATE UNIQUE INDEX uq_ledger_stay_fee ON ledger_entries (stay_request_id) WHERE kind = 'stay_fee'")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_ledger_stay_fee")
    op.execute("DELETE FROM ledger_entries WHERE kind = 'stay_fee'")
    op.execute("ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_kind_check")
    op.execute(
        "ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_kind_check CHECK (kind IN "
        "('move_in_fee', 'scout_bounty', 'listing_upgrade', 'assist_fee', 'adjustment', 'legacy_commission'))"
    )
    op.execute("ALTER TABLE ledger_entries DROP COLUMN IF EXISTS stay_request_id")
    op.execute("DROP TABLE IF EXISTS host_agreements")
    op.execute("DROP TABLE IF EXISTS stay_request_events")
    op.execute("DROP TABLE IF EXISTS stay_requests")
    op.execute("DROP INDEX IF EXISTS idx_inquiries_product_time")
    # Contacts without a place (concierge chats) and booking-request contacts cannot satisfy the old constraints.
    op.execute("DELETE FROM inquiries WHERE listing_id IS NULL OR channel = 'request'")
    op.execute("ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_channel_check")
    op.execute("ALTER TABLE inquiries ADD CONSTRAINT inquiries_channel_check CHECK (channel IN ('whatsapp', 'call'))")
    op.execute("ALTER TABLE inquiries ALTER COLUMN listing_id SET NOT NULL")
    op.execute(
        """
        ALTER TABLE inquiries
          DROP COLUMN IF EXISTS heard_from, DROP COLUMN IF EXISTS landing_path, DROP COLUMN IF EXISTS utm_content,
          DROP COLUMN IF EXISTS utm_campaign, DROP COLUMN IF EXISTS utm_medium, DROP COLUMN IF EXISTS utm_source,
          DROP COLUMN IF EXISTS handled_by, DROP COLUMN IF EXISTS product
        """
    )
    op.execute("ALTER TABLE bnb_details DROP COLUMN IF EXISTS monthly_price, DROP COLUMN IF EXISTS weekly_price")
