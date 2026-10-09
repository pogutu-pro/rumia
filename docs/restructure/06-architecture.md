# 06 · Technical Architecture

Covers: frontend architecture, backend architecture, API architecture, reliability and observability, security.

Rule applied throughout: keep what works, change only where there is a concrete engineering or product benefit, and add infrastructure only when a requirement forces it.

---

## 1. Target architecture

```
                 Cloudflare (DNS, TLS, CDN cache for public GETs and media, WAF, rate limiting at the edge)
                        │
                     nginx (VM)
           ┌────────────┴─────────────┐
     Next.js (web)               FastAPI (api)  ◄── Expo app (frozen, see §2.4)
     - public SSR/ISR pages       - modular monolith
     - BFF for cookies/session    - one process type: api
     - no image processing        │
           │ internal network     │
           └──────────►───────────┤
                                  ├── worker (same codebase, separate process: jobs + schedules)
                                  ├── Postgres 17 (+ PostGIS, pg_trgm)  ── nightly + offsite backups
                                  ├── R2 (images, raw uploads)  ·  Cloudflare Stream (video)
                                  └── Brevo (email) · WhatsApp/SMS provider · Web Push
     Telemetry: Sentry (errors, traces, releases) · PostHog (product analytics) · first-party events table
```

Differences from today:

| Change | Why |
|---|---|
| Separate **worker** process (one replica) for jobs and schedules | Today cron and retries run in each of 4 web workers, causing duplicate sends (`01` D11) |
| Postgres-backed job queue (`SKIP LOCKED`), no Redis/Celery | Volume is small; one less system to run and back up. Revisit if jobs exceed ~100/s |
| Web → API over the internal network with the real client IP forwarded | Fixes the shared rate-limit bucket and removes a hop through the public edge |
| Image processing moves from Next to direct-to-R2 upload + worker processing | Next process shouldn't do CPU-heavy work; bulk onboarding would stall pages |
| PostGIS + pg_trgm extensions | Distance to landmarks, map bounds, typo-tolerant search, without a search engine |
| Cloudflare edge caching for public pages and API GETs | Cheapest performance win for Kenyan users; protects the single VM |

Not introduced, deliberately: microservices, Kubernetes, Kafka, Elasticsearch/OpenSearch, Redis, CQRS, GraphQL, a separate recommendation service. Each is addressed in `11-roadmap-and-risks.md` §3 with the trigger that would justify it.

---

## 2. Frontend

### 2.1 Keep

Next.js App Router, React 19, TypeScript, Tailwind 4, shadcn/ui, Sentry, PostHog, the service-worker hygiene from `1e862c1`.

### 2.2 Change

| Decision | Problem → Recommendation → Reasoning |
|---|---|
| **Typed API client generated from OpenAPI** | Hand-written `lib/api/*` (30+ files) drift from the backend; mobile already generates types. → Generate `openapi-typescript` types + `openapi-fetch` client for web too. → One contract, compile-time breakage instead of runtime |
| **Server Components for public pages, TanStack Query for interactive client state** | ~70 files fetch in `useEffect`; TanStack Query installed but unused. → Public pages fetch on the server (cached by ISR/edge). Workspace and console use TanStack Query for lists, mutations and optimistic updates. → Removes hand-rolled loading/error state, gives caching and retries |
| **Remove Axios** | Two HTTP stacks. → `fetch` via the generated client |
| **Zustand only for ephemeral cross-component UI state** (compare tray, intent draft) | Four stores exist (filter, bnb filter, wishlist, compare). Filters belong in the URL; wishlist belongs in server state. → Keep compare/intent only |
| **Route groups by surface**: `(public)`, `(seeker)`, `(workspace)`, `(ops)` | Today `(admin)`, `(manager)`, `(dashboard)` duplicate tables and forms. → Two internal surfaces share components |
| **Feature folders** inside `src/features/{property,search,saved,listing-editor,queues,…}` with components, hooks and API calls together | Very large single files (1,000–1,800 lines) mixing concerns |
| **Dependency diet** | Remove `@supabase/*`, `axios`, `three`, `react-confetti`, `react-icons`, `@heroicons/react`, `chart.js`/`react-chartjs-2`, Cypress (keep Playwright), `fuse.js` (search moves server-side), `web-push` server lib if push sending moves to the backend |
| **Session**: access token in an httpOnly cookie, read only by the Next server (BFF); browser calls go to Next route handlers or to the API with a short-lived token | `rumia_at` is readable by JS today. → Reduces XSS blast radius |
| **Anonymous device id** (first-party cookie) | Needed for saves without an account, attribution, and personalization before sign-in |

### 2.3 Rendering strategy

| Page | Strategy |
|---|---|
| Property `/p/{slug}` | ISR (revalidate on listing change via on-demand revalidation webhook from the API) + edge cache. Personal bits (saved state) load client-side after paint |
| Place / landmark landings | ISR, 10 min |
| Search | Server-rendered first page from URL params; client navigation thereafter |
| Home | Static shell + server-rendered market sections; personal sections client-side |
| Workspace / console | Client-rendered behind auth |

### 2.4 Native app

**[FACT]** An Expo app lives at `nginx/mobile/`, consuming the same API.

**[REC]** **Freeze native development** (security fixes and API compatibility only) until the web product loop is proven. Move the folder to `apps/mobile/`.

- **Reasoning.** Distribution is links that open in browsers; every hour on native is an hour not on the page those links open. A small team can't run web + PWA + native + two consoles well.
- **Trade-off.** Push notifications on iOS require an installed PWA (iOS 16.4+), which few users do. Alerts therefore go primarily via WhatsApp/SMS/email. Revisit native when repeat usage justifies a home-screen presence (e.g. listers updating availability daily).

---

## 3. Backend

### 3.1 Keep

FastAPI, async SQLAlchemy 2, asyncpg, Pydantic 2, the session-scope pattern, own auth, structlog, Sentry, uv.

### 3.2 Module boundaries

Reorganise today's 25 slices into domain modules. Each owns its tables; other modules call its service functions, never its tables.

| Module | Owns | Absorbs today's |
|---|---|---|
| `identity` | users, sessions/refresh tokens, OTP, devices | `auth`, parts of `profiles` |
| `access` | staff assignments, org memberships, permission checks | `security.py` role logic, `manager` staff, `admin` roles |
| `geo` | markets, places, landmarks | `regions`, `campuses`, `zones` |
| `catalog` | lister orgs, properties, units, offers (listings), lifecycle | `listings`, `bnb`, `agents`, `admin` transfers |
| `media` | assets, uploads, processing, video | `images`, YouTube fields |
| `trust` | verification evidence, external registries, reports, moderation actions, audit log | `official_hostels`, `listings/verification.py`, `reviews` moderation |
| `discovery` | search, feed, ranking, similar, intent parsing | `search`, feed parts of `listings`, `analytics` view counts |
| `engagement` | saves, saved searches/alerts, inquiries + reference codes, outcomes | `profiles` wishlists, `leads`, `notifications/wishlist_service` |
| `ledger` | outcome-based money records, payouts | `leads` commissions, `tours` payments |
| `assist` | paid seeker requests (if kept) | `hostel_requests`, `tours` |
| `notify` | delivery of email, WhatsApp/SMS, push; templates; preferences | `notifications`, `core/email`, integrations |
| `events` | first-party event ingestion and aggregates | `analytics` |
| `ops` | queues as read models over other modules; market health | `manager`, `admin/console_*` |
| `content` | legal documents, site banner | `legal`, `announcements` |

Reviews: keep the data, stop investing until there is enough volume to make reviews meaningful; then reviews are tied to a confirmed inquiry (only people who contacted can review).

### 3.3 Conventions

- **Routers** thin: parse, authorise via `require(permission)`, call one service function, return a schema.
- **Services** hold rules and transactions. A service function is one unit of work; it emits domain events into an outbox table in the same transaction (§3.4).
- **No raw `text()` SQL** for writes except in migrations; reads may use it where SQLAlchemy is unclear, with tests.
- **No `except Exception: pass`.** Best-effort work goes to a job with retries and visibility.
- **One ORM model per table.** Remove `AgentProfile`/`Agent` duplication and `extend_existing`.
- **Enums as Postgres enums or CHECK constraints**, mirrored as Python `StrEnum`.

### 3.4 Jobs, schedules and the outbox

- `jobs` table: `id, kind, payload, run_at, attempts, locked_by, locked_until, last_error, status`. Worker claims with `SELECT … FOR UPDATE SKIP LOCKED`. Idempotency key per job.
- `outbox` written in the same transaction as the domain change; the worker turns outbox rows into jobs (notifications, cache revalidation, search re-index of derived fields, event fan-out). This removes "commit then hope the background task runs".
- Schedules (freshness sweep, digests, archive rollups) run only in the worker.
- A small library (e.g. `procrastinate`) is acceptable if it fits; a 200-line in-house implementation is also fine at this volume.

### 3.5 Search and feed

- Postgres FTS (`tsvector` over title, place names, description) + `pg_trgm` for fuzzy matching of names, behind one `discovery.search(query, filters, intent, cursor)` function.
- Geo filters with PostGIS (`ST_DWithin` to a landmark, bounding box for map).
- Ranking computed in SQL from precomputed columns (`quality_score`, `freshness`, `popularity_7d`) plus request-time intent fit (`08-intelligence.md` §4).
- Cursor pagination, max 50 per page.
- Revisit a dedicated search engine only if: > ~200k live offers, or p95 search latency > 300 ms after indexing work, or a need for features Postgres can't serve.

---

## 4. API

**[FACT]** REST under `/api/v1`, OpenAPI snapshot in CI, error envelope exists but three error shapes are in use.

**[REC]**

- **Keep REST + OpenAPI**; it serves web, mobile and future partners. No GraphQL.
- **Resource naming by domain**: `/properties`, `/offers`, `/search`, `/places`, `/landmarks`, `/me/saves`, `/me/searches`, `/inquiries`, `/orgs/{id}/…`, `/ops/queues/…`, `/events`.
- **One error envelope** everywhere, including validation errors (override FastAPI's default 422 shape) and rate limits.
- **Cursor pagination** (`?cursor=…&limit=…`, max 50).
- **Idempotency keys** on POSTs that create things from mobile/poor networks (listing create, inquiry create, uploads).
- **ETags** on property and search GETs for edge caching.
- **Versioning**: keep `/v1`; make additive changes; deprecate with a sunset header and a CI check against the frozen mobile client's used endpoints.
- **Public bulk endpoints removed** (`/public/verify-candidates`); replace with per-item lookups, rate limited.

---

## 5. Reliability and observability

### 5.1 Service levels (initial targets)

| Journey | SLI | Target |
|---|---|---|
| Property page | Successful renders, p75 LCP on mobile | 99.9%, < 2.5 s |
| Contact | `contact_initiated` that open WhatsApp without error | 99.9% |
| Search | Successful responses, p95 latency | 99.9%, < 400 ms |
| Sign-in | Started vs completed (excluding user cancels) | ≥ 95% |
| Lister create | Drafts that reach submit without error | ≥ 99% of attempts error-free |
| Freshness jobs | Reconfirmation sweep completes daily | 100% of days |

### 5.2 Instrumentation

- **Request id** generated at nginx, propagated web → API → worker → logs → Sentry.
- **Structured logs** (already structlog) shipped off-box (e.g. Grafana Cloud free tier, Better Stack or Axiom). Today logs live in `docker logs` with 3×10 MB rotation, which loses evidence within days.
- **Sentry**: release tagging on both tiers (source maps already uploaded), every handled failure on critical journeys reported with a cause tag (the audit found auth branches that redirect without reporting), alert rules on new issues in critical paths.
- **Uptime and synthetic checks** from outside the VM: home, a property page, search, `/health/readiness`, sign-in start.
- **Job health**: queue depth, oldest job age, failures per kind, visible in the ops console and alerting.
- **Business guardrails** alerting: contacts per hour dropping to 0 in daytime, sign-ins completed vs started below threshold.

### 5.3 Delivery

- CD runs only after CI passes on the same commit (`workflow_run` or a single workflow with `needs`).
- Images built in CI, tagged with the commit SHA, pushed to a registry (GHCR). The VM pulls tags; rollback = previous tag.
- Migrations run as a deploy step before the new API starts; expand/contract discipline so old and new code both work during the switch.
- Health-check gate: deploy fails and rolls back if readiness fails.
- **Staging**: a second compose project on the same VM (or a small second VM) with its own database restored nightly from an anonymised production dump. Needed for migrations rehearsal and for testing in-app browser flows on real phones.
- Backend Dockerfile copies `uv.lock` and uses `uv sync --frozen` without fallback.

### 5.4 Capacity and failure

- One VM is acceptable now. Document RTO/RPO: RPO 24 h (nightly dumps) is likely too loose once listers update daily; add WAL archiving to R2 (e.g. `pgBackRest` or `wal-g`) for point-in-time recovery, RPO minutes.
- Connection budget: API workers × pool size must stay below Postgres `max_connections` with headroom; add PgBouncer only if worker count grows.
- Cloudflare caching absorbs traffic spikes from viral shares; the API should never see most public page loads.

---

## 6. Security

| Area | Recommendation | Ref |
|---|---|---|
| Authorisation | Permission-based checks with scope (§`04` 3.3); fail closed on lookup errors; check user and org status on every request (cached ≤ 60 s) and on refresh | D22 |
| Privilege escalation via migrations | New Alembic baseline from live schema; the admin-by-email trigger is not in it | D4 |
| Client IP | nginx sets `X-Real-IP` from Cloudflare's `CF-Connecting-IP` (only trusting Cloudflare ranges); web forwards it to the API on server calls; API trusts only that header from known proxies | D5 |
| Rate limits | At Cloudflare for coarse abuse; in the API per real IP and per user for auth, OTP, inquiry creation, reports, uploads | D5 |
| Sign-in methods | Add phone OTP (SMS/WhatsApp) with strict per-number and per-IP limits, OTP expiry ≤ 5 min, attempt caps; watch SMS-pumping fraud by restricting to +254 initially | `05` §4 |
| Sessions | httpOnly access cookie; refresh rotation already good; sign-out-everywhere | D23 |
| CSP | Remove `unsafe-eval`; move inline scripts to nonces | D23 |
| Data exposure | No bulk endpoints with phones or M-Pesa details; lister phone revealed per inquiry action (still public by design, but not enumerable) | D30 |
| Uploads | Presigned PUT with content-type and size limits; server-side validation and re-encoding in the worker; strip EXIF location from public variants (keep for verification evidence privately) | |
| Secrets | Move the SSH key and passphrase file out of the repo working tree; rotate anything shared in chat (checklist in `DB_MIGRATION.md`); one secret store (at minimum, a password manager + server env files; later, a secrets manager) | D28 |
| Audit log | Every staff and lister action that changes state recorded with actor, before/after, reason | `04` §4 |
| Data protection | Kenya's Data Protection Act 2019 applies to seeker and lister personal data. Likely obligations include registration with the ODPC, a lawful basis and notice for analytics and personalization, data subject access/deletion, and retention limits. **Confirm with a Kenyan data protection adviser**; this is not legal advice | `08` §2 |
| Dependency hygiene | Dependabot/Renovate for both lockfiles; `pip-audit` and `pnpm audit` in CI | |
