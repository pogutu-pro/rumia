# Runbook: migration 0010 (RumiaBnB stays)

Apply after `0008`/`0009` (see `0008-0009-rollout.md`), with the same backup → rehearsal → apply steps.

## What it changes

- `bnb_details`: new nullable `weekly_price`, `monthly_price`.
- `inquiries`: new columns `product` (default `rumia`), `handled_by` (default `host`), `utm_*`, `landing_path`,
  `heard_from`; `listing_id` becomes nullable; the channel check also accepts `request`. Existing rows are valid as-is.
- New tables `stay_requests`, `stay_request_events`, `host_agreements`.
- `ledger_entries`: new nullable `stay_request_id`; the kind check also accepts `stay_fee`; one stay fee per request.

All additive. Rehearsed locally: upgrade, downgrade to `0009`, upgrade again.

## Settings (backend env)

| Name | Default | Meaning |
|---|---|---|
| `BNB_CONCIERGE_WHATSAPP` | empty | The staffed RumiaBnB number. Empty: concierge chats answer 409 and the site hides the button |
| `BNB_FEE_PERCENT` | `10` | Default fee when a host has no agreement |
| `BNB_FEE_MIN_KES` | `500` | Minimum fee per completed stay |
| `BNB_FEE_NIGHT_CAP` | `30` | Fee counted on the first N nights only |
| `BNB_PUBLIC_URL` | `https://rumiabnb.rumia.co.ke` | Links in host notifications |

Per-host terms are recorded at `POST /api/v1/ops/stays/agreements` and override the defaults from their start date.

## Rollback

Leave the schema in place (nothing reads it until the new endpoints are used). `alembic downgrade 0009` exists but
deletes stay requests, stay fees and concierge contacts recorded since: only use it before go-live.
