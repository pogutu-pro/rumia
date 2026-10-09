# 07 · Domain Model and Database Strategy

Covers: domain model, database strategy, geographic data model.

---

## 1. Problem → evidence → recommendation

**Problem.** The data model encodes the original product: a hostel near a campus, posted by one agent.

**Evidence [FACT].**

- `listings`: ~50 columns, free-text `property_type` default `hostel`, hostel-only columns on every row (`gender`, `bathroom_type`, `distance_to_campus`, `distance_category`, `price_single`, `price_sharing`, `room_type_enum`, `pays_commission`), `campus_id` and one `agent_id`.
- Short stays in a 1:1 side table `bnb_details` with their own API.
- No lifecycle beyond `is_active`/`is_full`; no `last_confirmed_at`.
- `profiles.campus_id NOT NULL` in production; `agents.campus_id NOT NULL`.
- `profiles.role` single value; two ORM classes on `agents`.
- Location as free-text `county`/`area` plus a campus-scoped `campus_zones`.
- Video as `youtube_id`.
- Migrations are Supabase-era SQL with documented drift from live.

**Recommendation.** A new core model introduced **additively** beside the old tables, backfilled, then switched to, then the old tables dropped (`10-quality-and-migration.md`). Not an in-place mutation of `listings`.

**Reasoning.** The changes are structural (one row → property + unit types; one agent → org; campus → places/landmarks). Doing them in place on a live table with 46 internal pages reading it would be slower and riskier than building beside it with a clean contract.

**Trade-off.** A period of dual models and a backfill to maintain. Bounded by doing the switch per surface, in weeks, not months.

---

## 2. Core model

```
users ─┬─< org_members >── lister_orgs ──< properties ──< property_units
       │                                      │  │  └──< property_media >── media_assets
       ├─< staff_assignments >── markets      │  ├──< verification_evidence
       │                           │          │  ├──< reports
       │                           ├──< places (tree) ── property.place_id
       │                           └──< landmarks ──< property_landmark_distances
       ├─< saves / saved_searches             │
       └─< inquiries >─────────────────────────┘  (also by device_id)
events (partitioned) · audit_log · outbox · jobs · ledger_entries
```

### 2.1 Identity and access

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, email (nullable), phone_e164 (nullable, unique when verified), display_name, avatar_url, status (`active`/`suspended`/`deleted`), created_at | Merges `auth.users` + `profiles`. No role, no campus |
| `auth_identities` | user_id, provider (`google`/`phone`), subject | Supports Google + phone OTP |
| `refresh_tokens` | (as today) | Keep current design |
| `devices` | id (anonymous device id), user_id (nullable), first_seen, last_seen | Bridges anonymous → signed-in |
| `lister_orgs` | id, name, slug, kind (`individual`/`company`), status (`provisional`/`active`/`suspended`), standing (`new`/`good`/`watch`), claimed_at, sourced_by_user_id | Replaces `agents` as owner of supply |
| `org_members` | org_id, user_id, role (`owner`/`manager`/`agent`), invited_by, created_at | |
| `staff_assignments` | user_id, market_id (nullable = all), role (`admin`/`market_lead`/`reviewer`/`scout`), active | Replaces `profiles.role` + `managed_*_id` |

### 2.2 Catalog

| Table | Key columns | Notes |
|---|---|---|
| `properties` | id, org_id, market_id, place_id, slug, name, kind (`hostel`/`apartment`/`house`/`compound`/`room`), location (`geography(Point)`), location_precision (`exact`/`approximate`), address_hint, description, amenities (`text[]` from a controlled list), included_utilities (`text[]`), house_rules (jsonb), status (lifecycle), last_confirmed_at, published_at, quality_score, tier (derived: `value`/`standard`/`premium`), audience (`text[]`: `students`, `professionals`, `families`, `visitors`), contact_member_id, created_by, sourced_by, created_at, updated_at | The public "listing" |
| `property_units` | id, property_id, unit_kind (`single_room`/`double_room`/`shared_room`/`bedsitter`/`studio`/`one_bed`/`two_bed`/`three_bed_plus`/`entire_home`), bedrooms, bathrooms, sharing (persons), bathroom (`ensuite`/`shared`), furnished (`none`/`partly`/`full`), size_m2, price_amount, price_currency (`KES`), price_period (`night`/`week`/`month`/`semester`), deposit_amount, min_stay, max_guests, count_total, count_available, gender_policy (`any`/`women`/`men`, hostels only), available_from | Replaces `listing_room_types` + price columns + `bnb_details` |
| `property_status_history` | property_id, from, to, actor, reason, at | Lifecycle audit |

Short stay = a unit with `price_period = night`. No separate tables or APIs. Fields that only apply to nightly stays (`max_guests`, `min_stay`, check-in times in `house_rules`) are nullable on the unit and only asked for in that branch of the editor.

Constraints: `price_amount > 0`; `count_available <= count_total`; `price_period` and kinds as enums; unique `slug`; `gender_policy` only when the property kind is `hostel` (CHECK via trigger or app rule).

### 2.3 Geography

| Table | Key columns | Notes |
|---|---|---|
| `markets` | id, slug, name, status (`hidden`/`pilot`/`live`/`paused`), boundary (`geography(Polygon)`), centroid, config (jsonb: reconfirm interval, price bands, contact defaults) | The operating unit |
| `places` | id, parent_id, market_id, kind (`county`/`town`/`neighbourhood`), name, slug, aliases (`text[]`), boundary (nullable), centroid | Seeded from today's `regions` (counties) and `campus_zones` (neighbourhoods) |
| `landmarks` | id, market_id, kind (`university`/`college`/`hospital`/`cbd`/`transport`/`other`), name, slug, aliases, location, features (jsonb: `school_email_domain`, `official_registry_id`) | DeKUT becomes a landmark with `school_email_domain = dkut.ac.ke` |
| `property_landmark_distances` | property_id, landmark_id, straight_m, walk_min_est | Precomputed on location change; used for filters, ranking and display |

Today's `campuses` columns map as follows: branding and SEO → `markets.config`/content; WhatsApp and fees → `markets.config`; `campus_zones.full_search_price` → Assist pricing config if Assist continues.

### 2.4 Media

| Table | Key columns |
|---|---|
| `media_assets` | id, org_id, kind (`image`/`video`), source (`upload`/`external_youtube`/`external_tiktok`), status (`pending`/`processing`/`ready`/`failed`/`rejected`), storage keys, variants (jsonb), width, height, duration_s, blur_data, exif_location (private), created_by |
| `property_media` | property_id, asset_id, position, room_tag (`exterior`/`room`/`bathroom`/`kitchen`/`common`/`view`/`other`), is_cover, unit_id (nullable) |

### 2.5 Trust and moderation

| Table | Key columns |
|---|---|
| `verification_evidence` | id, subject (`property`/`org`/`user`), subject_id, kind (`phone_otp`/`availability_confirm`/`site_visit`/`registry_match`/`ownership_doc`), status, observed_at, expires_at, actor_id, data (jsonb), media (asset ids) |
| `external_registries` / `external_registry_entries` | Generalises `dekut_official_hostels` |
| `reports` | id, property_id, reason, details, reporter_user_id/device_id, status, priority, resolved_by, resolution, created_at |
| `moderation_actions` | id, subject, action, reason, actor, at |
| `audit_log` | actor, action, entity, entity_id, before, after, request_id, at |

### 2.6 Engagement and money

| Table | Key columns |
|---|---|
| `saves` | id, user_id or device_id, property_id, unit_id (nullable), created_at |
| `saved_searches` | id, user_id, intent (jsonb: market, places, landmark + radius, kinds, unit_kinds, price range + period, must-haves), channels, frequency, last_notified_at, active |
| `inquiries` | id, ref_code (short, unique per 90 days), property_id, unit_id, org_id, channel (`whatsapp`/`call`), device_id, user_id, session_id, source (page/surface), created_at, lister_replied (nullable), outcome (`moved_in`/`not_suitable`/`no_reply`/`unknown`), outcome_source, outcome_at |
| `ledger_entries` | id, kind (`move_in_fee`/`scout_bounty`/`listing_upgrade`/`assist_fee`/`adjustment`), org_id/user_id, amount, currency, status, source_ref (inquiry/property id), created_by, created_at |

### 2.7 Platform

| Table | Purpose |
|---|---|
| `events` | First-party behavioural events, partitioned by month (`08-intelligence.md`) |
| `outbox` | Domain events written in the business transaction |
| `jobs` | Work queue claimed with `SKIP LOCKED` |
| `notification_deliveries` | Keep today's delivery tracking, generalised to channel |

---

## 3. Derived data

Computed by jobs, stored as columns, so reads are cheap and rules are testable:

| Field | Inputs |
|---|---|
| `properties.place_id` | Point-in-polygon on neighbourhood boundaries, else nearest centroid; overridable by ops |
| `property_landmark_distances` | Location vs landmarks in market |
| `properties.tier` | Price percentile within market × kind × unit_kind, plus verification and media quality |
| `properties.quality_score` | Media count and coverage, video present, trust level, freshness, description completeness, lister response rate |
| `properties.popularity_7d` | From events: opens, saves, contacts, de-duplicated per device |
| Freshness state | `last_confirmed_at` vs market interval |

---

## 4. Database strategy

### 4.1 Keep

One Postgres 17 instance. It handles this domain to millions of rows; the risks are integrity and operability, not capacity.

### 4.2 Change

| Decision | Reasoning |
|---|---|
| **Alembic, with a baseline generated from the live production schema** (not from `supabase/migrations`) | The SQL history has drift and a dangerous trigger. Live is the truth. After baseline, every change is a reviewed Alembic revision run by deploy |
| **Expand → migrate → contract** for every breaking change | Zero-downtime deploys with old and new code running during switch |
| **Enums/CHECKs, NOT NULLs, FKs on all relationship columns** | The ORM declares no FK on several relationship columns (`wishlists.*`, `tour_bookings.agent_id`, `agent_applications.user_id`, `hostel_requests.user_id`); whether live has them is unverified. The baseline must make them explicit either way |
| **Extensions: `postgis`, `pg_trgm`, `unaccent`** | Geo queries and fuzzy search without new infrastructure |
| **Monthly partitions for `events`**, retention policy (raw 13 months, aggregates indefinitely) | Event volume will outgrow all other tables combined; partitions make retention a `DROP` |
| **Drop the `auth` schema shim** and the Supabase-compatibility functions after the `users` merge | Supabase is decommissioned |
| **Point-in-time recovery** via WAL archiving to R2 | RPO from 24 h to minutes (`06` §5.4) |
| **Read models for ops queues** as SQL views or materialised views refreshed by jobs | Keep the console fast without denormalising core tables |
| **PII inventory** with column-level classification; seeker phone numbers stored only when given for a stated purpose | Data protection compliance (`06` §6) |

### 4.3 Indexing (initial)

- `properties (market_id, status, kind)`, GiST on `location`, GIN on FTS `tsvector`, trigram on `name`.
- `property_units (property_id)`, `(price_period, price_amount)`.
- `inquiries (ref_code)`, `(org_id, created_at desc)`, `(device_id)`.
- `events` partitions: `(occurred_at)`, `(property_id, occurred_at)` for aggregates, `(device_id, occurred_at)`.
- Verify with `EXPLAIN ANALYZE` on a seeded dataset of 50k properties in CI's performance job.

---

## 5. Mapping from today

| Today | Target |
|---|---|
| `listings` row | `properties` row + 1..n `property_units` |
| `listings.price`, `price_single`, `price_sharing`, `listing_room_types` | `property_units` (one per room type; if none, one from `price` with inferred `unit_kind`) |
| `bnb_details` | `property_units` with `price_period = night` + `house_rules` |
| `listings.agent_id` → `agents` | `lister_orgs` (one per agent, kind `individual`) + `org_members` (agent's user as `owner` or `agent`). Listings with a `landlord_phone` get a provisional owner contact recorded for later claim |
| `listings.campus_id`, `county`, `area`, `zone_id` | `market_id` (Nyeri), `place_id` (from zone/area), coordinates retained |
| `distance_to_campus`, `distance_category`, `proximity_description` | Discarded after landmark distances are computed; kept in an archive column for one release |
| `verified`, `verified_source`, `verified_date` | `verification_evidence` (`registry_match`) |
| `is_active`, `is_full` | `status` (`live`/`paused`) and `count_available = 0` |
| `youtube_id` | `media_assets` with `source = external_youtube` |
| `listing_images`, `image_uploads` | `media_assets` + `property_media` |
| `profiles` + `auth.users` | `users` + `auth_identities` + `staff_assignments` |
| `wishlists` | `saves` |
| `leads` | `inquiries` (historical, `ref_code` null) |
| `commissions` | `ledger_entries` (historical, kind `legacy_commission`) |
| `listing_views` + rollups | `events` (`property_opened`) + aggregates |
| `tour_bookings`, `hostel_requests` | `assist_requests` if Assist continues; else archived |
| `reviews` and related | Keep tables; reattach to `property_id` |
| `transfer_history` | `audit_log` |
| `campuses`, `regions`, `campus_zones` | `markets`, `places`, `landmarks` |
