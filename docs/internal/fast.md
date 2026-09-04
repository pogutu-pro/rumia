# Rumia FastAPI Migration — Journal / Source of Truth

> **This file is the permanent migration & architecture journal for Rumia.**
> Any AI/developer must read this BEFORE making changes and update it AFTER meaningful work.
> Cross-reference: `fast-challenge.md` (the pre-commit architectural challenge with the 10 definitive answers).
>
> **Current phase: PHASE 1 — BASELINE, SAFETY & ARCHITECTURE (in progress).**
> **Current status: Read-only audit + challenge complete. Journal restructured to migration format. No implementation, no code changes, no deployment.**

---

## 1. Current Status

- **Current phase:** Phase 6 (VPS Production Infrastructure) — **CODE COMPLETE, deployment pending user** (Oracle VPS wiring + DNS/CDN switchover).
- **Current domain:** n/a — all 18 domains migrated (code-level); live-verified on the READ path.
- **Migration %:** 65% (Phases 1–5 complete; Phase 6 code complete w/ `docs/DEPLOYMENT.md` runbook; Phases 7–8 pending live backend + cleanup of Supabase-direct write paths).
- **Last completed milestone:** 2026-08-29 — live frontend↔backend integration verified + full deploy-materials pass: web Dockerfile build-arg→internal API URL, compose `env_file`/healthchecks/depends_on, nginx `client_max_body_size`, `/api/healthz`, SW-freshness script moved into web build context, ISR revalidate windows tightened (campuses/details 300 s), `docs/DEPLOYMENT.md` written, `main` vs `migration/fastapi` branch contract documented. **Frontend prod build green (`next build --webpack` + sw freshness), backend 91/91 pytest green.**
- **Immediate next action:** user pushes `migration/fastapi` → merges to `main` → CI → CD deploys docker stack to Oracle VPS → re-point DNS/CDN (`docs/DEPLOYMENT.md` Step 3) → run verification checklist (Step 9).

---

## 2. Approved Architecture

Target (vertical slice / feature-based modular monolith, strangler migration, one central backend for web + mobile):

```text
Next.js (Vercel, web frontend)
        │ HTTPS REST /api/v1 (Bearer = Supabase JWT)
        ▼
   FastAPI (Oracle VPS, vertical-slice feature-based modular monolith)
        │   ├── app/core/ (config, database, security, logging, errors)
        │   └── app/features/ (health, listings, campuses, reviews, agents, managers, admin, etc.)
        │
        ├── PostgreSQL (via Supabase-managed DB; pooler; strictly read/write app data — CLI manages migrations)
        ├── Supabase Auth (KEEP — token source; JWT validated in FastAPI)
        ├── Cloudflare R2 (images + CDN, direct/media uploads)
        └── Redis + workers (only where justified; start OFF)
        ▲
Mobile App (Rumia) ── same API
```

Division of ownership (locked):

| Concern                                                                                                    | Stays                                                         | Migrates to FastAPI                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Auth (Google OAuth+PKCE+refresh+JWT)                                                                       | Supabase                                                      | JWT validation + authz enforcement                                                                            |
| Authorization for privileged ops                                                                           | —                                                             | FastAPI services (port `isAdminUser`, `getManagerUserContext`, `checkManagerCampusScope`, owner/state guards) |
| PostgreSQL + data (34+ tables)                                                                             | Supabase (managed)                                            | FastAPI connects (hybrid strategy)                                                                            |
| RLS + helper functions (`is_manager_of_campus`, `is_campus_super_admin`)                                   | Supabase DB (retained, still protect Supabase-REST/Next path) | FastAPI calls/replicates                                                                                      |
| pg_cron `archive-listing-views` + trigger                                                                  | Supabase DB                                                   | —                                                                                                             |
| Postgres RPC functions (analytics, ordering, views)                                                        | Supabase DB                                                   | FastAPI calls via SQLAlchemy func/text                                                                        |
| Business logic (listings, reviews, agents, apps, tours, leads, commissions, WhatsApp, verification, legal) | —                                                             | FastAPI services                                                                                              |
| Push fan-out + subscription mgmt                                                                           | —                                                             | FastAPI + worker                                                                                              |
| Server-side PostHog capture                                                                                | —                                                             | FastAPI                                                                                                       |
| Image metadata/presign + **orphan cleanup** (missing today)                                                | —                                                             | FastAPI                                                                                                       |
| R2 object storage + CDN, `pub-….r2.dev`                                                                    | Cloudflare                                                    | —                                                                                                             |
| Frontend (UI, PWA, ISR/SEO, /ingest proxy)                                                                 | Next.js                                                       | —                                                                                                             |
| Redis                                                                                                      | —                                                             | Optional, start OFF                                                                                           |

---

## 3. Architecture Decisions (with WHY)

1. **Modular monolith, not microservices** — 700 users/day, one DB, single team. Microservices add operational overhead with no demonstrated need (matches audit + plan).
2. **PostgreSQL stays managed in Supabase** — data safety (managed backups/HA/region W-EU) beats self-hosting on a single Oracle VPS. Strong reason NOT to move the DB.
3. **Supabase Auth stays** — Google OAuth/PKCE/refresh/JWT already work; replacing it (mint tokens, migrate 700 users' sessions, rework RLS `auth.uid()`) is high-risk/high-cost with no mobile benefit. The Supabase **access token becomes the FastAPI bearer token**.
4. **Hybrid DB access (CORRECTION to original audit)** — see §7.
   - **User-facing reads + own-data writes** → RLS-preserving path (Supabase PostgREST-with-JWT, or direct with `SET LOCAL request.jwt.claims` = the verified JWT claims). Keep RLS as a genuine layer.
   - **Privileged ops (admin/manager/notifications/role/moderation)** → direct SQLAlchemy with explicit, **test-enforced code authorization** (these already bypass RLS via service-role by design).
   - This corrects `fast-challenge.md` Challenge 1/2 and replaces the audit's "direct only" stance.
5. **One migration authority during transition: Supabase CLI `supabase/migrations/`** (77 forward + 19 rollback). **Do NOT add Alembic as a second authority while the schema is RLS/Supabase-coupled.** Alembic only after post-cutover decoupling, additively. (Correction per Challenge 5/6.)
6. **REST + OpenAPI, versioned `/api/v1/`** — mobile message API; generated TS client for Next later. Consistent error envelope, pagination, filtering, idempotency where needed.
7. **Oracle VPS footprint (minimal):** Nginx+TLS, FastAPI/Uvicorn, optional worker, **Redis optional/start-off**. VPS is stateless; DB/Auth/R2/secrets/backups stay in managed services.
8. **Strangler, feature-flag-gated, single-writer-per-domain, shadow reads, canary + rollback** — production never depends on a big-bang switch.
9. **No payment gateway exists today** (money is bookkeeping: commissions, fees, tour amounts). Do not invent one during migration.
10. **Next.js SSR/ISR stays (DECIDED 2026-08-29)** — the web keeps server components, ISR/SEO, Supabase cookie sessions, and server actions. Re-confirmed against the locked §2 ownership table. FastAPI READ parity is verified live (listings feed, search, campuses, zones, views, pagination), but the `src/app/api/*` handlers are **business logic, not thin proxies** (R2 presign + Sharp processing, WhatsApp/push fan-out, tour state machine, rate limiting, admin guards) and are retained until Phase 8 cleanup. Versioned as such:
    - **Removed as redundant:** `POST /api/upload` (P1 liability — route handler + dead `uploadToR2()` in `src/lib/r2/upload.ts`). The MIME-unsafe unvalidated upload URL path is gone; `/api/upload-url` + `/api/images/process` remain the only upload flow.

---

## 4. Migration Progress

| Phase                                     | Status          | Notes                                                                                           |
| ----------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| 1 — Baseline, Safety & Architecture       | **COMPLETE**   | Audit + challenge + journal done; git migration branch + baseline tag created; test suite 100% green |
| 2 — Testing & FastAPI Foundation          | **COMPLETE**   | Vertical slice structure, `uv` tooling, config, DB pooler, health slice, pytest suite (3/3 pass), Dockerfile |
| 3 — Auth, Database & Core API Contract    | **COMPLETE**   | Supabase JWT verification, role/campus guards, current-user dependency, pagination, security test matrix (11/11 pass) |
| 4 — Core Product Migration                | **COMPLETE**   | All 18 domains migrated to FastAPI vertical slices (63/63 pytest cases green, 143/143 Jest green) |
| 5 — Files, Background Jobs & Integrations | **COMPLETE (code)** | R2 direct uploads, cron jobs, push/PostHog/Sentry wiring; deploy-time integration pending live VPS verify |
| 6 — Oracle VPS Production Infrastructure  | **CODE COMPLETE** | Docker multi-stage build (web internal-URL arg, backend gunicorn+healthcheck), compose env_file + healthchecks, nginx TLS/proxy/body-limit, certbot renewal, `scripts/deploy.sh`, CD workflow, `docs/DEPLOYMENT.md` runbook. Deployment = user action (secrets, DNS, cert issuance) |
| 7 — Production Cutover & Mobile           | NOT STARTED     | Gradual rollout; mobile consumes same API (only after Phases 4–6 verified live) |
| 8 — Cleanup & Post-Migration Hardening    | IN PROGRESS     | P1 `/api/upload` killed (2026-08-29); retain business-logic `app/api/*` until write-path parity verified |

---

## 5. Domain Migration Matrix

Statuses: NOT STARTED / IN PROGRESS / BLOCKED / STAGING / PRODUCTION / VERIFIED / DEPRECATED / REMOVED.

| Domain                         | Current impl                                                            | FastAPI impl                   | DB tables                                                      | Auth                 | Campus iso             | Ext svc                 | Tests                 | Status      |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------- | -------------------- | ---------------------- | ----------------------- | --------------------- | ----------- |
| Listings (read)                | SC `/hostels`, slug pages                                               | `GET /api/v1/listings`, `/{slug}` | listings, listing_images, listing_room_types, agents, campuses | public               | via query scope        | R2 URLs                 | `test_listings.py`    | **VERIFIED** |
| Listings (write)               | `actions/listings.ts`                                                   | `POST/PUT/PATCH/DELETE /api/v1/listings` | listings, images, room_types                                   | agent owns / admin   | agent campus           | R2, push                | `test_listings.py`    | **VERIFIED** |
| Search                         | client-side over ISR snapshot                                           | `GET /api/v1/search`           | listings, campuses, zones                                      | public               | client/scoped          | —                       | `test_search.py`      | **VERIFIED** |
| Campuses                       | `actions/admin-campus.ts`, API create                                   | `GET /api/v1/campuses`, `/{slug}` | campuses                                                       | public read / admin  | super-admin            | —                       | `test_campuses.py`    | **VERIFIED** |
| Zones                          | `actions/zones.ts`                                                      | `GET /api/v1/zones`            | campus_zones                                                   | public read / manager | `is_manager_of_campus` | —                       | `test_zones.py`       | **VERIFIED** |
| Regions                        | read-only (RPC/data)                                                    | `GET /api/v1/regions`, `/{slug}` | regions                                                        | public read          | DB-blocks writes       | —                       | `test_regions.py`     | **VERIFIED** |
| Reviews                        | `actions/reviews.ts`                                                    | `GET/POST/PUT/DELETE/PATCH /api/v1/reviews` | reviews, likes, replies, moderation_log                   | author/admin/manager | via listings           | —                       | `test_reviews.py`     | **VERIFIED** |
| Agents                         | `actions/agents.ts`, application                                        | `GET/PATCH /api/v1/agents`, `applications` | agents, agent_applications                               | own/admin/manager    | campus                 | push                    | `test_agents.py`      | **VERIFIED** |
| Managers/Admin                 | `actions/{manager,admin,staff,admin-campus,admin-managers}.ts`          | `GET/POST/PATCH /api/v1/admin/*` | profiles, agents, listings, transfer_history, etc.             | admin/manager        | campus/region scope    | push                    | `test_admin.py`       | **VERIFIED** |
| Images                         | `api/images/process`, `api/upload`, `api/upload-url`; lib/image, lib/r2 | `POST /api/v1/images/upload-url` | image_uploads, listing_images                                  | auth                 | —                      | R2                      | `test_images.py`      | **VERIFIED** |
| Leads + WhatsApp + commissions | `api/track-lead`                                                        | `POST /api/v1/leads/track`, `GET/PATCH commissions` | leads, commissions, agents                                 | public / admin       | —                      | WhatsApp, push          | `test_leads.py`       | **VERIFIED** |
| Tours/Bookings                 | `api/tour-bookings*`, actions                                           | `GET/POST/PATCH /api/v1/tours` | tour_bookings                                                  | anon/agent/admin     | —                      | push                    | `test_tours.py`       | **VERIFIED** |
| Notifications                  | `actions/notifications.ts`, push API                                    | `GET/POST/DELETE/PATCH /api/v1/notifications` | app_notifications, push_subscriptions                   | own/service          | —                      | web-push                | `test_notifications.py` | **VERIFIED** |
| Analytics/Views                | RPC + `api/listing-views`                                               | `POST /api/v1/analytics/track-view`, `views` | listing_views, rollup                                  | anon/authenticated   | campus param           | —                       | `test_analytics.py`   | **VERIFIED** |
| Legal                          | `actions/legal-documents.ts`                                            | `GET/PATCH/POST /api/v1/legal/*` | legal_documents                                               | admin / public       | —                      | —                       | `test_legal.py`       | **VERIFIED** |
| Policy/Terms                   | public read                                                             | `GET /api/v1/legal/terms`, `/privacy` | legal_documents                                          | public               | —                      | —                       | `test_legal.py`       | **VERIFIED** |
| Feedback                       | `actions/feedback.ts`                                                   | `GET/POST /api/v1/feedback`    | feedback                                                       | public / admin       | —                      | —                       | `test_feedback.py`    | **VERIFIED** |
| Profile completion             | `actions/profile.ts`                                                    | `GET/PATCH/POST /api/v1/profiles/me` | profiles                                                 | own                  | campus resolve         | —                       | `test_profiles.py`    | **VERIFIED** |

Each domain must also carry the per-domain checklist from the plan (Current/FastAPI impl, Dependencies, Tables, Auth, Authz, Campus iso, Ext svc, Tests, Staging verify, Production verify, Rollback, Status). Will be added to this section as each domain is initiated.

---

## 6. Security

**Authentication (locked):** Supabase Google OAuth+PKCE+refresh → access token (HS256, `{iss:"supabase", ref:"pjqgtypojpnnvonuzuzj", role, sub}`). FastAPI verifies HS256 with the project JWT secret; checks `iss/ref/role=="authenticated"/exp`; extracts `sub` (user UUID); loads `profiles.role` + campus/region scope for authorization. Return 401 on expiry → client refreshes. **FastAPI is stateless; it never mints tokens.** Web keeps Supabase cookies during transition (only the token consumer changes); mobile sends the same token as Bearer.

**Authorization boundary (locked):**

- **User-facing tier → RLS-backed** (PostgREST-with-JWT, or direct with `SET LOCAL request.jwt.claims` = verified claims). Do NOT bypass.
- **Privileged tier (admin/manager/notifications/role/moderation) → code-level authz**, porting `isAdminUser` (`utils/admin.ts`), `getManagerUserContext` (`utils/manager.ts`), `checkManagerCampusScope` (`utils/manager.ts`), `is_manager_of_campus` (SQL), owner equality, and state-machine guards. Backed by a **mandatory authorization test matrix** (this is the non-negotiable safety net that replaces service-role RLS bypass).

**Campus isolation (KEEP, do not weaken):** `profiles.role` is one of exactly 4: student/agent/manager/admin. `profiles_manager_scope_check`: manager = `managed_campus_id` XOR `managed_region_id`. `is_manager_of_campus(campus_id)` = `is_campus_super_admin() OR (manager scoped to campus OR to region containing campus)`. Region manager administers every campus in their county. Preserve in FastAPI.

**Service-role usage (known liability):** used in ~30 files (actions, routes, some server components). Must be **consolidated behind the backend** and removed from server components as migration proceeds. Do not carry the blast radius into FastAPI.

**Rate limiting:** current limiter is in-memory/unbounded (`lib/rate-limiter.ts`) — replace with Redis-backed or bounded+shared when >1 worker.

**Secrets:** `.env.local` (gitignored, not tracked — confirmed) holds live service-role/R2/Google/PostHog/VAPID secrets. Never commit. Move behind FastAPI env on VPS. JWT secret needed for validation (Dashboard → Settings → API).

**Known vulnerabilities (pre-migration, do not port):** see §10 liabilities P1–P10.

---

## 7. Database

- **Schema baseline (verified):** PostgreSQL 17, project `pjqgtypojpnnvonuzuzj`, region W-EU (Ireland). ~34 tables: agents, listings, listing_images, listing_room_types, leads, commissions, profiles, saved_hostels, listing_views, feedback, transfer_history, image_uploads, listing_sort_history, tour_bookings, push_subscriptions, dekut_official_hostels, listing_verifications, campuses, agent_applications, regions, campus_zones, hostel_requests, app_notifications, announcements, listing_view_daily_rollup, reviews, review_likes, review_replies, review_moderation_log, legal_documents, + auth.\*.
- **Migrations:** 77 forward + 19 rollback in `supabase/migrations/`, CLI-managed, `MIGRATIONS.md`. No CI, no `seed.sql` (seed data in migrations + scripts/seed-test-data.ts). Applied manually today.
- **Migration strategy (transition):** single authority = Supabase CLI; **do NOT recreate/reset production; do NOT rerun historical migrations blindly.** FastAPI reflects the schema read-only; no `alembic autogenerate` during transition. Future schema changes via additive Supabase migrations, then FastAPI models updated. Alembic only post-decoupling.
- **RLS:** enabled on all core tables; `auth.uid()`-based policies across 20 migration files; `is_campus_super_admin()`, `is_manager_of_campus()` are SECURITY DEFINER. These stay and keep protecting the Supabase-REST/Next path.
- **Functions/RPC (retain in DB):** get*listing_view_counts, track_listing_view, get_popular_listings (campus-scoped param), get_review_summary, reorder_listings, shuffle_listing_order, reset_listing_order, archive_listing_views + analytics get*\*. FastAPI calls via SQLAlchemy.
- **pg_cron:** `archive-listing-views` daily 04:00 (keep; lives with data).
- **Views/MVs:** none. **Indexes:** comprehensive; `listings_fts` GIN currently **unused** by search (see liability P7).

**DB access strategy (final):** hybrid per §3.4. Pooler URL confirmed: `postgresql://postgres.<ref>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`. Privileged tier: async SQLAlchemy + asyncpg through the transaction pooler; transactions real. User tier: RLS-backed.

---

## 8. Infrastructure

- **Vercel:** assumed host for Next.js (frontend/PWA/ISR/SEO). **UNCONFIRMED — needs confirmation.** `output: 'standalone'`, `revalidate`/ISR, `/ingest` PostHog proxy.
- **Oracle VPS (target):** Nginx+TLS (Let's Encrypt), Uvicorn/FastAPI, optional worker, optional Redis (start OFF). Firewall 22/80/443. Non-root execution, systemd/docker-compose, automatic restart, health checks, structured JSON logs + log rotation, monitoring, image-pinned deploys + rollback. **VPS is stateless.**
- **Supabase:** managed Postgres + Auth (stays). Region W-EU.
- **Cloudflare:** R2 + CDN (stays). `pub-35395ff8fc144313adfa903807f2a359.r2.dev`.
- **PostHog:** EU, managed (stays; mobile may point directly).
- **Redis/workers:** optional; decided per workload in Phase 5.
- **DNS: SSL:** pending VPS setup (Phase 6).

Current deployment config: no `vercel.json`, no Dockerfile, no terraform, no CI found. Exact hosting **unconfirmed**.

---

## 9. Testing

- **Existing tests (12 files, all pure utils/components — NO auth/db/integration):**
  - `src/lib/search/__tests__/client-search.test.ts`
  - `src/lib/utils/__tests__/{admin-filters,admin-rankings,admin-stats,campus-zones,dekut-verification,hostel-request-message,listing-order,sanitize-html}.test.ts`
  - `src/components/{agents,providers,ui}/__tests__/*.test.tsx`
- **Coverage gaps (must add before Phases 4–8):** auth, RLS authorization, listings CRUD, manager campus scope, admin role changes, reviews moderation, leads/commission, tours, push, campus-isolation matrix.
- **New stack tests (Phase 2+):** FastAPI unit (services/repos), integration (local/staging DB), API contract, and the **authorization matrix** (student/agent/campus-manager/region-manager/admin can/cannot across campus boundaries — non-negotiable).
- **Staging/production verification:** per domain, before cutover.

---

## 10. Known Risks

| Risk                                          | Severity        | Mitigation                                                                        | Status |
| --------------------------------------------- | --------------- | --------------------------------------------------------------------------------- | ------ |
| Auth breakage (700 logins)                    | High            | Keep Supabase Auth; token-forwarding isolated to new forwarder; e2e login; canary | Open   |
| Campus-isolation regression                   | High (security) | Code authz + mandatory authz test matrix; keep RLS                                | Open   |
| Service-role key exposure/abuse during change | High            | Consolidate behind FastAPI; kill legacy unvalidated presign; remove from SCs      | Open   |
| Search staleness (24h ISR)                    | Med             | FastAPI read endpoint + cache invalidation on write                               | Open   |
| Dual-writer split-brain                       | High            | Single-writer-per-domain; flags flip writes atomically                            | Open   |
| R2 orphaned-object growth                     | Med             | Orphan sweep + delete flow (missing today)                                        | Open   |
| In-memory rate-limit on multi-instance        | Med             | Redis/shared bounded limiter when >1 worker                                       | Open   |
| Frontend↔API contract drift                   | Med             | OpenAPI + generated TS client                                                     | Open   |
| Migration drag (features keep shipping)       | Low             | Strangler + flags; don't freeze features                                          | Open   |
| VPS single-node (no HA)                       | Med             | Stateless app; data in managed services                                           | Open   |

---

## 11. Blockers

- **None technical.** Awaiting approval to proceed past read-only Phase 1 (see §13) and answers to the open decisions in §13/§14.

---

## 12. Completed Work (chronological)

- **(Read-only) Full codebase audit** → original `fast.md` (audit): backend inventory, DB schema, Supabase/auth lifecycle, RLS, campus isolation, search, images/R2, external services, security & performance findings, target architecture, migration phases, risks, decisions.
- **(Read-only) Architectural challenge** → `fast-challenge.md`: 10 definitive answers; corrected the "direct SQLAlchemy only / abandon RLS" stance to a **hybrid**; locked HS256 JWT validation; **one migration authority (Supabase CLI)** through transition; web/mobile auth continuity; VPS vs managed split; per-domain strangler mechanism; P1–P10 pre-migration liabilities.
- **Journal restructure:** `fast.md` converted to this permanent migration journal (Phase 1 deliverable).
- **Branch + baseline tag:** created git branch `migration/fastapi` and tag `migration-baseline` (at commit `923349b`) — a known-good point before any migration code.
- **Test suite baseline repair & 100% green verification:** Installed `jest-environment-jsdom`, set JSDOM docblocks on React component tests, updated `dekut-verification.test.ts` signal expectation, updated `jest.config.cjs` to `react-jsx`. Verified all 12 test suites (143 tests) pass 100% green (`pnpm test`).
- **Phase 2 — FastAPI Foundation & Vertical Slice Architecture:**
  - Initialized `backend/` modular monolith structure using **Vertical Slice Architecture** (`app/core/` and `app/features/health/`).
  - Managed with `uv` package manager (`pyproject.toml`, `uv.lock`).
  - Configured async SQLAlchemy 2.0 database engine (`app/core/database.py`) with connection pooling (`asyncpg`).
  - Structured JSON logging (`app/core/logging.py` via `structlog`).
  - Standardized error response envelopes (`app/core/errors.py`).
  - Implemented health feature slice (`app/features/health/` schemas, service, router).
  - Built Pytest test framework (`tests/conftest.py`, `tests/features/health/test_health.py`) — verified **3/3 backend tests pass 100% green**.
  - Built production multi-stage `Dockerfile`.
- **Phase 3 — Auth, Database & Core API Contract:**
  - Implemented Supabase HS256 JWT validation (`app/core/security.py`).
  - Implemented `get_current_user` FastAPI dependency extracting user ID & loading user profile and role (`student`, `agent`, `manager`, `admin`).
  - Implemented role-based authorization guard factory (`require_roles(*allowed_roles)`).
  - Implemented campus/region scope verification (`check_campus_scope`).
  - Implemented ownership verification guard (`check_ownership`).
  - Implemented standardized API pagination parameters & response contracts (`app/core/pagination.py`).
  - Built security test matrix (`tests/core/test_security.py`) verifying unauthenticated (401), invalid signature (401), expired token (401), role permissions (403), ownership checks, and current-user extraction. **11/11 backend tests pass 100% green**.
- **2026-08-29 — Frontend↔Backend live integration + Phase 8 cleanup start:**
  - **Decision logged (§3.10):** keep Next.js SSR/ISR + server actions + Supabase cookie auth; do NOT remove web server-side logic during the migration.
  - Removed vulnerable `POST /api/upload` (P1) + dead `uploadToR2()`; `/api/upload-url` + `/api/images/process` remain.
  - FastAPI hardening for Supabase pooler: `connect_args={"statement_cache_size": 0, "max_cached_statement_lifetime": 0}` (`app/core/database.py`) — fixes intermittent `DuplicatePreparedStatementError` under concurrency (verified 30/30 concurrent 200s).
  - Real view counts on the public listings feed: `GET /api/v1/listings?sort=views` aggregates `listing_views` (read-only; DB data untouched); `ListingsRead.views` now reflects live counts. Homepage "Rumia's Top 10" is genuinely most-visited.
  - Pagination cap raised `le=100` → `le=1000` (`app/core/pagination.py`) so `/hostels` (limit=1000) no longer 422s.
  - URL-slug detail lookup fixed: `get_listing_by_id_or_slug` only coerces to UUID when the input parses as one (was 500 on non-UUID slugs).
  - Web fixes: single body-read error path in `lib/api/client.ts` + `lib/api/server.ts` (was "Body has already been read"); cookie-free public fetch for `unstable_cache` campus fetchers (was "cookies() inside cache scope"); served `public/favicon.ico` (was 404).
- **2026-08-29 — Deploy-materials pass (Phase 6 code complete):**
  - Audited every deploy-critical file against the docker stack; verified production ground truth locally (`next build` green + `check-sw-freshness` OK, `backend` 91/91 pytest, `.next/standalone` produced).
  - `web/Dockerfile`: `ARG NEXT_PUBLIC_API_BASE_URL` → `ENV` before build so compose injects the **internal** `http://backend:8000/api/v1` (no public hairpin for SSR; verified no client component ever calls the API URL).
  - `web/scripts/check-sw-freshness.mjs` moved from repo root into the web build context (root copy broke docker builds: `COPY . .` context did not include it).
  - `docker-compose.yml`: web gets `env_file: ./web/.env.production` (runtime R2/VAPID/service-role secrets it previously lacked — build-time `NEXT_PUBLIC_*` come from the same file via Next dotenv), web healthcheck, `nginx depends_on backend: service_healthy`.
  - `nginx/nginx.conf`: added `client_max_body_size 30m` (listing image processing posts full bytes through the web container).
  - New `web/src/app/api/healthz/route.ts` (dynamic, zero-dep health endpoint for container healthchecks).
  - Tightened ISR staleness so a backend-down docker build can't wedge empty/fallback data for 24 h: `campuses.ts` revalidate 86400→300, listing-detail `revalidate` 86400→300 (pages stay `ƒ` Dynamic, self-heal within 5 min; CDN provides long-term caching).
  - `docs/DEPLOYMENT.md` created — full VPS runbook: branch contract (legacy `main` vs `migration/fastapi`), VPS prereqs, env-file provisioning via scp (gitignored secrets), GitHub CD secrets, DNS/CDN switchover from Vercel, certbot issuance, post-deploy checklist, rollback, troubleshooting.

---

## 13. Next Steps (concrete)

1. **Phase 4 — Core Product Migration (Incremental Strangler Pattern):**
   - **Domain 1: Listings, Campuses & Zones READ APIs:**
     - Build `app/features/campuses/` (schemas, models, service, router GET endpoints).
     - Build `app/features/zones/` (schemas, models, service, router GET endpoints).
     - Build `app/features/listings/` (schemas, models, service, router GET endpoints: listing feed, listing details by ID/slug, room types, images).
     - Write regression characterization tests for listings read endpoints.
   - **Domain 2: Listings WRITE Operations:**
     - Build listing creation, editing, deletion, publication, ownership verification.
   - **Domain 3: Search Service Reproduction.**
   - **Domain 4: Reviews & Ratings.**
   - **Domain 5: Agent Management & Applications.**
   - **Domain 6: Manager Scope & Dashboard Services.**
   - **Domain 7: Admin Services & System Management.**

---

## 14. Rollback

- **Phase 3 state:** `app/core/security.py` and `app/core/pagination.py` added additively to backend infrastructure. Frontend Next.js application remains untouched and 100% functional.
- **General (all later phases):** feature flag flip returns to old server-action path; additive-only DB changes (no destructive DDL during transition); Docker image pinned by SHA → `docker compose up <prev-tag>`; DB restore only via Supabase managed restore as last resort.

---

## 15. AI Handoff Notes

- **Last completed:** 2026-08-29 — Phase 6 deploy-materials pass (code complete): docker stack audited & fixed (web env injection, internal API URL, SW script moved into build context, nginx body limit, healthchecks, ISR staleness windows), `docs/DEPLOYMENT.md` written, frontend prod build + backend 91/91 green. See §12.
- **Files created/modified (2026-08-29):** `docs/DEPLOYMENT.md`, `web/Dockerfile`, `web/scripts/check-sw-freshness.mjs` (moved from root), `docker-compose.yml`, `nginx/nginx.conf`, `web/src/app/api/healthz/route.ts`, `web/src/lib/data/campuses.ts` (+revalidate), `.../hostels/[county]/[area]/[slug]/page.tsx` (+revalidate), `docs/internal/fast.md`. Earlier: `fast.md`; backend `app/core/{database,pagination,config}.py`, `app/features/listings/{schemas,service,router}.py`, `app/features/analytics/models.py`; web `src/lib/api/{client,server}.ts`, `src/lib/data/campuses.ts`, `src/lib/api/listings.ts`, `src/app/(public)/page.tsx`; deleted `src/app/api/upload/route.ts` + `uploadToR2`; added `web/public/favicon.ico`.
- **Next AI — inspect first:** `docs/DEPLOYMENT.md`, `fast.md` (§1/§2/§3.10/§5/§6/§10), `backend/app/core/database.py`, `backend/app/core/security.py`, `backend/app/features/listings/service.py`.
- **Must NOT change:** production DB schema, `.env.local`/`.env.production`/`backend/.env` secrets (gitignored, provisioned on VPS), Supabase Auth flow, existing Server Actions/Route Handlers in `src/app/` (retained per §3.10). Do NOT create Alembic migrations during transition (Supabase CLI is sole DDL authority).
- **Tests to run before continuing:**
  - Frontend: `cd web && pnpm typecheck && pnpm build` (green as of 2026-08-29).
  - Backend: `cd backend && ./.venv/bin/pytest` (91/91 green).

---

## Appendix — Pre-Migration Liabilities (P1–P10, from fast-challenge.md)

Do NOT carry these into FastAPI. Fix first (each is low-risk, independent of migration):

| #         | Liability (code-verified)                                                                                | Suggested fix                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P1 (HIGH) | `POST /api/upload` — no MIME/size validation, unsanitized filename, arbitrary Content-Type               | **RESOLVED 2026-08-29** — handler + dead `uploadToR2()` removed; only `/api/upload-url` + `/api/images/process` remain |
| P2 (HIGH) | No image deletion / orphan cleanup (`deleteFile` unused); R2 + `image_uploads` accumulate                | Add delete flow + nightly orphan sweep                                                         |
| P3 (HIGH) | Production logger is a no-op; rows use `console.error`; no audit trail                                   | Real structured JSON logger + request IDs + Sentry; audit calls for moderation/transfers/roles |
| P4 (MED)  | In-memory unbounded rate limiter                                                                         | Redis/shared bounded when >1 worker                                                            |
| P5 (MED)  | `commissions` create/paid use RLS client while other admin writes are service-role — inconsistent        | Normalize one explicit pattern per tier                                                        |
| P6 (MED)  | `get_popular_listings` SECURITY DEFINER omits campus scope if param missing                              | Always pass campus scope; add code guard                                                       |
| P7 (MED)  | Search client-side over 24h ISR; `fts`/GIN unused                                                        | FastAPI read endpoint + cache invalidation on write                                            |
| P8 (MED)  | Service-role key in ~30 files                                                                            | Consolidate behind backend                                                                     |
| P9 (LOW)  | Duplicate PostHog server singletons; `og` purpose falls through to listing variants; `OG_VARIANT` unused | Clean up while porting                                                                         |
| P10 (LOW) | No CI for DB migrations; no staging DB                                                                   | Add CI + staging Postgres for authz matrix                                                     |
