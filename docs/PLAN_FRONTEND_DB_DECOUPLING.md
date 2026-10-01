# Plan: Remove all direct database access from the web frontend

**Status:** IN PROGRESS — Phase 0 and Phase 1 done (see §13). Decisions confirmed 2026-10-01: keep `app/api/*` as thin same-origin cookie proxies; parity-diff against a restored production snapshot; phase order agent → manager → admin.
**Parent effort:** Supabase → self-hosted Postgres (see `DB_MIGRATION.md`). This is **step 2**; it must land before the database cutover (step 1 cutover) and before the custom-auth work (step 3).

## 1. Goal and rule

> The browser and the Next.js server never talk to the database. All data access goes
> **web → FastAPI → Postgres**. FastAPI is the only component that holds DB credentials
> and the only place authorization is enforced.

After this work, `@supabase/*` is used for **authentication only** (and is deleted in step 3).
No `.from()`, `.rpc()`, `.storage`, or `supabase.auth.admin.*` data/admin calls remain in `web/`.

### Why (what is wrong today)
1. **The service-role key lives in the web app.** `lib/supabase/admin.ts` *and* `lib/supabase/public.ts`
   both build clients from `SUPABASE_SERVICE_ROLE_KEY`, which **bypasses RLS**. Authorization is therefore
   hand-written in ~110 TypeScript call sites; one missed check is a full data leak/escalation.
2. **The browser queries the DB directly** (13 client-component files) with the anon key, relying on RLS
   policies. RLS is the only barrier and it is being retired with Supabase.
3. **Two sources of business logic.** Verification, campus scoping, commission rules, hostel-request
   state machines exist in both `web/src/app/actions/*` and `backend/`. They drift.
4. **Blocks the migration.** The web app is hard-wired to Supabase's REST (PostgREST) interface, so
   pointing the backend at a new Postgres would silently split data (web writes → Supabase, API → new DB).

## 2. Inventory (measured, not guessed)

~300 direct calls in ~70 files. `@supabase/*` is in `package.json` (`@supabase/ssr`, `@supabase/supabase-js`).

| Area | Files | Calls | Execution context |
|---|---|---|---|
| `app/actions/*` (server actions) | 8 | 112 | Server, **service role** |
| `app/(admin)/**` pages | 20 | 54 | Server, service role |
| `app/(dashboard)/**` (agent) | 13 | 33 | Server |
| `app/(manager)/**` | 8 | 32 | Server |
| `app/api/**` route handlers | 9 | 21 | Server, service role |
| `lib/**` | 7 | 18 | mixed (`push.ts`, search, utils) |
| `app/(public)/**` | 8 | 15 | mixed |
| `app/account/**` | 3 | 8 | **Browser** |
| `components/**`, `hooks/**` | 4 | 9 | **Browser** |

**Tables touched (call count):** agents 66, listings 52, profiles 42, campuses 38, campus_zones 17,
hostel_requests 14, tour_bookings 12, dekut_official_hostels 10, leads 9, listing_room_types 7,
regions 6, agent_applications 6, push_subscriptions 5, commissions 5, listing_images 4, reviews 3,
legal_documents 2, and 1 each: transfer_history, listing_sort_history, image_uploads, feedback,
app_notifications, announcements.

**RPCs called directly (8):** `track_listing_view`, `shuffle_listing_order`, `reorder_listings`,
`get_review_summary`, `get_registered_student_count`, `get_platform_view_summary`,
`get_admin_listing_view_analytics`, `get_admin_agent_view_analytics`.

**Browser-side direct DB (highest risk — fix first):**
`(public)/auth/login/page.tsx` (agents, campuses, profiles) · `(public)/listing/[id]/book-tour-form.tsx` and
`contact-modal.tsx` (profiles) · `(public)/compare/page.tsx`, `components/compare/featured-hostel-card.tsx`,
`components/feedback/early-access-banner.tsx`, `lib/search/cascade-search.ts`, `lib/search/fuzzy-search.ts` (listings) ·
`app/account/page.tsx` (agents, campuses, listings, profiles, tour_bookings), `account-tours-tab.tsx`,
`find-me-a-hostel.tsx` (campuses, campus_zones) · `components/reviews/reviews-section.tsx` (reviews, profiles, rpc) ·
`hooks/use-tour-zones.ts` (campuses, campus_zones).

**Server route handlers with direct DB:** `api/listing-views`, `api/tour-bookings` (+`[id]`), `api/track-lead`,
`api/push/subscribe|unsubscribe`, `api/images/process`, `api/campuses/create`, `api/auth/check-email`.

**Auth-admin operations (tie into step 3):** `admin.ts` `createAgentAction` uses `auth.admin.createUser/deleteUser`;
`staff.ts` and `(manager)/manager/staff/page.tsx` use `auth.admin.listUsers`.

**Mobile is already clean for data** (everything goes through `lib/api/client.ts` → FastAPI).
Mobile uses Supabase only for auth (`signInWithOAuth`, `exchangeCodeForSession`, `getSession`,
`refreshSession`, `signOut`, and one `signInWithPassword`) → handled in step 3, no work here.

## 3. What the backend already has (do not rebuild)

`backend` already exposes ~102 endpoints under `/api/v1` across: admin, agents, analytics, announcements,
bnb, campuses, feedback, health, hostel-requests, images, leads, legal, listings, notifications, profiles,
regions, reviews, search, tours, zones. SQLAlchemy models exist for every table the web touches **except
`dekut_official_hostels` and `listing_sort_history`**. `core/security.py` already provides
`require_roles(...)`, `AuthenticatedUser.is_admin/is_manager`, `managed_campus_id/managed_region_id`, and
`check_campus_scope(...)` (campus/region scoping for managers) — these replace `lib/utils/admin.ts` and
`lib/utils/manager.ts`. The web already has a typed client layer `web/src/lib/api/*` with `server.ts`
(`apiServer`) and `client.ts`; `actions/bnb.ts` and `actions/listings.ts` already follow the target pattern.
`listings/verification.py` is a Python port of `lib/utils/dekut-verification.ts`.

## 4. Target architecture

```
Browser ──(Server Action / fetch)──▶ Next.js (render + cache + revalidatePath only)
                                         │  Bearer <user JWT>   (apiServer / apiClient)
                                         ▼
                                   FastAPI  ── auth (JWT) + RBAC + campus scope + validation + business rules
                                         ▼
                                   Postgres (only FastAPI connects)
```

Rules:
- Server actions become **thin**: call a `lib/api/*` function, then `revalidatePath/Tag`. No SQL-shaped logic,
  no role checks, no scoping in TS.
- Authorization is **only** in FastAPI (`require_roles`, `check_campus_scope`, ownership checks). The web may
  *hide UI* by role for UX, but is never the security boundary.
- The web forwards the **user's JWT**; it never holds a privileged DB/service credential.
  `SUPABASE_SERVICE_ROLE_KEY` is removed from web build args, env, and `docker-compose.yml`.
- Public reads (SSR for listings, campuses, regions, legal) call **public** FastAPI endpoints with
  `next: { revalidate }`/tags instead of `supabasePublic`.
- Each endpoint is one DB transaction; multi-step flows (create agent, approve application, transfer listing,
  hostel-request status changes + notifications) become a **single service method** (atomic) rather than the
  current sequence of independent REST calls.
- DB-side functions (the 8 RPCs) are called from FastAPI services via `text()`/SQLAlchemy, or re-implemented
  as SQL in the service; the web never calls them.

## 5. Domain map: web function → backend endpoint

Legend: **EXISTS** = endpoint present in `openapi.json` (verify shape/permissions in the first task of the
phase); **EXTEND** = endpoint exists, needs added fields/params/permission; **NEW** = must be built.

### A. Public & student surface (Phase 1–2)
| Web today | Direct DB | Target endpoint | State |
|---|---|---|---|
| Public listing/campus/region/zone reads, sitemap, `verify`, `agents/[slug]`, `hostels/[county]/[area]`, `compare` | listings/campuses/regions/campus_zones/agents | `GET /listings`, `/listings/{slug}`, `/campuses`, `/regions`, `/zones`, `/agents/{id}` (+ `/agents/slug/{slug}`) | EXISTS / EXTEND (slug lookup, compare-by-ids) |
| `cascade-search`, `fuzzy-search`, navbar search | listings | `GET /search` | EXTEND (cascade + fuzzy params) |
| Early-access banner / featured card | listings | `GET /listings?featured=…` | EXTEND |
| `account/page.tsx` profile, saved, tours | profiles, listings, tour_bookings, agents, campuses | `/profiles/me`, `/profiles/me/saved`, `/tours/me`, `/campuses` | EXISTS |
| `find-me-a-hostel`, `use-tour-zones` | campuses, campus_zones | `/campuses`, `/zones` | EXISTS / EXTEND (tour price) |
| `login/page.tsx` post-login routing | agents, campuses, profiles | `GET /profiles/me` (+ role, agent, campus in one response) | EXTEND |
| `api/auth/check-email` | profiles | `GET /profiles/check-email` (rate-limited, no PII leak) | NEW |
| `book-tour-form`, `contact-modal` prefill | profiles | `/profiles/me` | EXISTS |
| `api/tour-bookings` (+`[id]`), `student-tour-bookings` | tour_bookings, listings, agents, profiles | `POST /tours`, `GET /tours/me`, `PATCH /tours/{id}/status` | EXISTS / EXTEND (cancel/update) |
| `api/track-lead` | leads, commissions, agents, listings | `POST /leads/track` | EXISTS |
| `api/listing-views`, `track_listing_view` rpc | agents + rpc | `POST /analytics/track-view` | EXISTS |
| Reviews (`reviews-section`, `actions/reviews.ts`) | reviews, profiles, rpc `get_review_summary` | `/reviews`, `/reviews/summary/{id}`, like/reply/moderate | EXISTS |
| Hostel requests (`hostel-requests.ts`, 16 calls) | hostel_requests, campuses, profiles | `/hostel-requests*` | EXISTS / EXTEND (manager list/by-id/status) |
| Feedback, announcements, legal docs | feedback, announcements, legal_documents | `/feedback`, `/announcements`, `/legal/*` | EXISTS |
| Notifications (`notifications.ts`, `lib/push.ts`) | app_notifications, push_subscriptions | `/notifications/*` | EXISTS (move **sending** push into backend) |
| `api/push/subscribe|unsubscribe` | push_subscriptions | `/notifications/push/subscribe|unsubscribe` | EXISTS |
| `api/images/process`, `api/upload-url` | image_uploads | `/images/upload-url`, `/images/{id}` | EXISTS / EXTEND (processing) |

### B. Agent dashboard (Phase 3)
| Web today | Target | State |
|---|---|---|
| `actions/listings.ts`, dashboard pages (listings, leads, earnings, tours, analytics, profile, new/edit) | `/listings*`, `/leads`, `/leads/commissions`, `/tours`, `/analytics/agent/{id}`, `/agents/{id}`, `/agents/me` | EXISTS / EXTEND (earnings summary, room types on listing create/update) |
| `listing_room_types` reads/writes | nested in `/listings` create/update payload | EXTEND |
| `actions/agents.ts`, `agent-application.ts` | `/agents/apply`, `/agents/applications/my`, `PATCH /agents/{id}` | EXISTS |
| BnB | already on FastAPI | DONE |

### C. Manager (Phase 4) — all must enforce `check_campus_scope`
| Web today (`actions/manager.ts`, 29 calls + 8 pages) | Target | State |
|---|---|---|
| applications list/approve/reject | `GET /agents/applications`, `PATCH /agents/applications/{id}/review` | EXISTS (approve must create agent atomically) |
| agents list/status | `GET /agents`, `PATCH /admin/agents/{id}/status` (manager-scoped) | EXTEND |
| listings list/status/phone/delete/update | `/listings*` with scope | EXTEND (manager scope + owner-phone patch) |
| hostels (`dekut_official_hostels`) | `/official-hostels` | **NEW (model + CRUD)** |
| zones (`zones.ts`) CRUD | `POST/PATCH/DELETE /zones` | **NEW (only GET exists)** |
| campus settings, announcements, staff, payments, transfers | `/campuses` PATCH, `/announcements`, `/admin/managers`, `/leads/commissions`, `/admin/agents/transfer` | EXISTS / EXTEND |

### D. Admin (Phase 5)
| Web today (`actions/admin.ts`, 50 calls + 20 pages) | Target | State |
|---|---|---|
| createAgent (auth user + profile + agent) | `POST /admin/agents` (**auth-user creation is deferred to step 3**, see §9) | NEW |
| update/delete listing, owner phone, commission lock/amount, active toggle | `/listings/{id}*`, `/listings/{id}/toggle-commission` | EXISTS / EXTEND |
| promote student→agent, role change, promote admin | `PATCH /admin/users/{id}/role`, `POST /admin/agents/promote` | NEW |
| agent status/featured/founder/verified/support/update | `PATCH /admin/agents/{id}*` | EXTEND |
| commissions create / mark paid | `POST /leads/commissions`, `PATCH …/pay` | EXTEND (create) |
| reorder / shuffle listings (rpc + `listing_sort_history`) | `PUT /admin/listings/order`, `POST /admin/listings/shuffle` | **NEW** (+ model `listing_sort_history`) |
| transfer listing | `POST /admin/agents/transfer` | EXISTS |
| verify listing / verify-all / verified toggle | `POST /admin/listings/{id}/verify`, `/verify-all`, `PATCH …/verified` using existing `verification.py` | **NEW (wire existing logic)** |
| official hostels CRUD + seed | `/admin/official-hostels*` | **NEW** |
| campuses/regions/managers | `/admin/campuses*`, `/admin/managers`, `/regions` | EXISTS / EXTEND (regions write) |
| admin dashboard stats & analytics (4 rpcs) | `/admin/stats`, `/analytics/platform/summary`, `/admin/analytics/*` | EXTEND / NEW |
| users list, leads, support, tours, feedback, legal, regions pages | corresponding `/admin/*` list endpoints | EXTEND / NEW |

## 6. Phased execution (each phase independently shippable; web + backend tested before the next)

**Phase 0 — Guardrails & scaffolding (no behavior change)**
1. Add ESLint `no-restricted-imports` (+ `no-restricted-syntax` for `.from(` / `.rpc(`) so *new* direct DB code fails CI;
   baseline the existing violations in an allow-list file that shrinks every phase until empty.
2. Add `scripts/check-no-direct-db.sh` (grep for `supabaseAdmin|supabasePublic|\.from\(['"]|\.rpc\(`) to `pre-push-check.sh` and CI.
3. Standardize the web API layer: one `lib/api/<domain>.ts` per backend router with typed request/response
   from the generated `openapi.json`; `apiServer` (SSR/actions, forwards user JWT) and `apiClient` (browser).
   Decide error contract (`ApiError {status, code, message}`) once.
4. Backend test harness for each new endpoint: authz matrix (anon / student / agent-owner / agent-other /
   manager-in-scope / manager-out-of-scope / admin) — template reused in every phase.
5. Contract tests: snapshot `openapi.json` and fail CI when it changes without regenerating web types.

**Phase 1 — Browser-side calls (security-critical, smallest blast radius first)**
Replace all 13 client-component direct queries (§2) with `apiClient` calls to existing/extended public + `/me`
endpoints. Add `check-email`, `/profiles/me` enrichment, search/compare extensions. Result: the browser has
**zero** DB access; anon key is no longer a data path.

**Phase 2 — Public SSR, route handlers, student actions**
Public pages/sitemap → public endpoints with `revalidate` tags. Convert `api/*` route handlers
(listing-views, track-lead, tour-bookings, push, images/process, campuses/create) to proxies or delete them
in favor of direct FastAPI calls where CORS/cookie rules allow. Convert reviews, hostel-requests (student side),
tour-bookings, notifications, feedback, profile actions. Move **push-notification sending** (`lib/push.ts`)
into the backend notification service.

**Phase 3 — Agent dashboard** (pages + `actions/listings.ts` remainder + earnings/leads/tours/analytics).

**Phase 4 — Manager** (build `official-hostels` + zone CRUD; enforce `check_campus_scope`; atomic approve/reject).

**Phase 5 — Admin** (largest: 50 calls in `admin.ts`; build the NEW endpoints in §5D; port the verification
actions onto `verification.py`; move reorder/shuffle RPC logic into the backend).

**Phase 6 — Remove the credential**
Delete `lib/supabase/admin.ts` and `public.ts`; remove `SUPABASE_SERVICE_ROLE_KEY` from web env, Docker build
args, CI and `docker-compose.yml`; the guard allow-list must be empty. The only remaining Supabase usage is
auth sessions (`lib/supabase/client.ts|server.ts|auth.ts`, `proxy.ts`, `auth/callback`).

Per-domain workflow (repeat for each row in §5):
1. Read the web function; list every field read/written and every authorization rule it enforces in TS.
2. Check the backend endpoint; extend or create it with the **same rules in Python** (+ tests, incl. the authz matrix).
3. Switch the web function to `lib/api/*`; keep its signature and return shape so UI components don't change.
4. Run web unit tests + backend tests; manual smoke of the page; keep `revalidatePath` in the action.
5. Delete the old direct-DB code and shrink the allow-list.

## 7. Backend work needed (net-new)

- Models: `DekutOfficialHostel`, `ListingSortHistory` (tables already exist in the DB).
- Routers/services: official hostels (manager + admin), zone create/update/delete, admin users/roles,
  admin listing order (reorder/shuffle/history), admin verification (use `verification.py`),
  admin analytics (move 4 RPCs behind endpoints), `profiles/check-email`, public slug lookups.
- Cross-cutting: pagination + filter params standardized (`limit`, `page`, `q`, `campus_id`, `status`);
  consistent `403` vs `404` (don't leak existence); response schemas replace ad-hoc `select('*')` shapes
  (no accidental PII such as phone/email in public responses — audit every `select('*')` in the web today).
- Performance: the web currently does many `select` + `in` fetches per page; add aggregate endpoints for the
  heavy dashboards (admin home 9 calls, agent dashboard 8, manager home 7) to avoid N round-trips;
  eager-load with `selectinload`/`joinedload` (the project already hit `MissingGreenlet` before).

## 8. Testing & verification

- **Backend:** pytest per endpoint with the authz matrix above (existing suite: 165 tests; new endpoints add to it).
  Add at least one real-DB integration test path using the scratch Postgres 17 + `db/00_supabase_shim.sql`
  (the existing mocked tests missed a 500 on `GET /listings` — that regression shipped; real-DB smoke is mandatory).
- **Web:** unit tests for each converted action (mock `lib/api`), Playwright smoke per role for the top flows
  (login → dashboard, create listing, approve application, admin verify, manager zone edit, student tour booking).
- **Parity check:** for each converted read page, temporarily compare the old Supabase result and the new API
  result on staging data (scripted diff) before deleting the old path.
- **Guard:** CI fails if any direct DB call or service-role reference reappears.

## 9. Interactions with the other migration steps

- **Auth (step 3):** until custom auth lands, FastAPI still verifies Supabase JWTs and the web forwards them via
  `apiServer`. `auth.admin.createUser/deleteUser/listUsers` (createAgent, staff pages) are the one thing that cannot move
  to Postgres yet: Phase 5 builds `POST /admin/agents` against an **auth-provider interface** with a Supabase
  implementation now and the custom-auth implementation in step 3. Keeps step 3 a swap, not a rewrite.
- **Cutover (step 1):** do the DB cutover **after Phase 6** (or at least after Phases 1–5 for all *writes*). Reads
  from the web to Supabase are harmless short-term; writes would split data.
- **RLS:** policies become dead weight once only FastAPI connects (single DB role). Do not rely on them; drop later.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Behavior drift when logic moves TS → Python | Same-signature adapters; parity diffs; port rules verbatim first, refactor later |
| Latency from extra hop / N+1 | Aggregate endpoints; caching tags on public reads; same-host Docker network (`backend:8000`) |
| Authorization regression (it moves, so can break) | Mandatory authz matrix tests per endpoint; manager out-of-scope tests |
| Big-bang temptation | One domain per PR; ship each phase; guard allow-list shrinks monotonically |
| `select('*')` shapes leak new fields | Explicit Pydantic response models; review public endpoints for PII |
| Mocked tests hide real bugs (already happened) | Real-DB smoke in CI against Postgres 17 |
| Admin actions currently non-atomic (multi-call) | Single service-layer transaction per action |

## 11. Definition of done

- `grep -rE "supabaseAdmin|supabasePublic|\.from\(['\"]|\.rpc\(|\.storage\b|auth\.admin" web/src` returns nothing.
- `SUPABASE_SERVICE_ROLE_KEY` absent from web env/Docker/CI.
- All §5 rows mapped to tested endpoints; authz matrix green; real-DB smoke green.
- Web builds and the Playwright role smoke passes; no UI regression on the 70 converted files.
- `@supabase/*` imports exist only under the auth modules (to be replaced in step 3).

## 12. Open questions (answer before Phase 1; none block research)

1. Should route handlers in `app/api/*` stay as thin same-origin proxies (cookie-based, avoids CORS) or be removed
   in favor of calling FastAPI from the browser? (Recommend: keep thin proxies for cookie-auth + CSRF simplicity.)
2. Is there staging data/environment to run parity diffs, or do we diff against a restored production snapshot
   (like the scratch pg17 restore)? (Recommend: restored snapshot.)
3. Priority order across Phases 3–5 if time is limited (recommend as written: agent → manager → admin).


## 13. Progress log and findings

### Done
- **Phase 0:** `scripts/check-no-direct-db.sh` + `web/.direct-db-allowlist.txt` (ratchet: new offenders fail, cleaned files must be removed from the list); wired into CI (`ci.yml`) and `scripts/pre-push-check.sh`. Baseline 84 files → **71** after phase 1.
- **Phase 1 (browser-side):** all 13 client-side direct-DB files converted (login, account page, account tours tab, find-me-a-hostel, tour zones hook, book-tour form, contact modal, compare page, featured card, early-access banner, reviews section). Dead code deleted (`lib/search/cascade-search.ts` DB paths and `fuzzy-search.ts`; shared types moved to `lib/search/types.ts`). **No browser code touches the database any more** (no allow-listed file imports the browser Supabase client).
- Backend additions: `GET /profiles/me` (+`agent_id`, `school_verified`); `GET /tours/me` (+`sort=upcoming`, embedded `listing` with images); `GET /campuses?status=a,b` and full campus metadata (SEO, `hostel_finding_fee`, `hero_image`); `GET /listings?ids=…` and `room_type_enum`/`mpesa_details` on `ListingRead`; reviews: `liked_by_me`, reply `updated_at`.
- **Security fixes found on the way:** `GET /reviews?status=hidden` and `GET /reviews/{id}` exposed unpublished (hidden/rejected) reviews to anyone → now published-only except for moderators and the author.
- Verified on a restored production snapshot (pg17): `/tours/me` returns the same 17 rows as SQL for the same user, correctly ordered; listings/campuses/zones/ids/reviews endpoints exercised.

### Key finding: backend models had drifted from the live schema (this is why the web bypassed FastAPI)
`backend/scripts/check_schema_drift.py` compares SQLAlchemy models with a real database. First run against the production snapshot found:
- **UUID columns mapped as `String`** in ~25 columns across 10 tables (tours, notifications, commissions, device tokens, feedback, hostel requests, leads, legal, listing views, push, transfers). Any query/insert on them fails with `operator does not exist: uuid = character varying`. **Fixed** (all now `PG_UUID(as_uuid=False)`).
- **Columns the models expected that the live DB does not have:** `tour_bookings.contacted` (it is a *status* value, not a column → now derived), `reviews.stay_start/stay_end` (never existed → removed). **Fixed.**
- **Still open (must be fixed before the domain is moved — Phase 2):** `feedback` (model `content, listing_id` vs DB `category, message, user_name`), `leads` (model `campus_id, source, user_id` vs DB `contact_type, name, phone`), `review_moderation_log` (model `note` vs DB `reason, previous_*/new_*`). These are genuine design differences, not typos: decide per table which side is right, and mirror the web's actual behaviour.
- Consequence for the plan: **endpoints for tours, reviews (list), feedback, leads, notifications, hostel-requests, legal, commissions and push were returning 500 in production before this work**; they had never served real traffic. Treat every "EXISTS" in §5 as *unverified* until it passes the real-DB smoke test with the authz matrix. Add `check_schema_drift.py` to CI against a Postgres built from a restored snapshot (or the migrations) so this cannot regress.

### Newly noticed, to handle in the relevant phase
- `ListingRead` returns `landlord_phone` publicly — audit what is meant to be public (Phase 2).
- Backend `create_review` hard-codes `school_verified_at_review_time=False`; the web action computes it — port that logic when reviews actions move (Phase 2).
- Four tour/review/profile endpoints now return richer shapes; mobile's generated types (`mobile/lib/api/types.ts`) should be regenerated from `openapi.json`.
- Order of work stays agent → manager → admin; Phase 2 (public SSR, route handlers, student actions) is next and starts by reconciling the three open tables above.
