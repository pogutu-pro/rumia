# Rumia: Production Readiness & Scalability Audit

Date: 2026-10-05. Scope: the repository at commit `d8c91b6` (branch `main`). Read-only: no application code, dependency, schema or production state was changed. This file is the only thing created.

## How to read this report

Every claim is tagged with how it was established:

- **[RAN]** I executed it (tests, scripts against the real app code, a throwaway Postgres 17 built from the repo's migrations).
- **[CODE]** I read the code and the conclusion follows from it, but I did not observe it at runtime.
- **[UNVERIFIED]** It needs production evidence I could not get. These are listed in section 11 with the exact commands to settle them.

What I could **not** do, and why it matters:

1. **No Sentry evidence.** There is no Sentry CLI, token, or MCP on this machine. Ranking real production errors by user impact is not possible from here. Everything below about "why signup fails" is derived from code and local execution, not from production telemetry.
2. **No production access.** The classifier on this machine denied SSH reads against the production VM, and I did not try to work around that. Production logs, the live schema, live triggers and live query plans are therefore unchecked.
3. **No browser or mobile-viewport run.** I did not drive the UI. Mobile and UX statements are from code only.
4. **No measured query plans on a realistic dataset.** I started to seed a local throwaway DB with 30,000 listings but that command was denied, so the database scalability section rests on index and query-shape analysis, not timings.

I also correct one thing from the earlier audit in this session: public landlord and agent contact details are **intentional** and are not treated as a defect here. What remains is an abuse-surface note (section 2, item 9).

---

## 1. Executive verdict

> **Can Rumia scale to hostels + apartments + premium properties + RumiaBnB across Kenya?**
> **PARTIALLY. Yes after stabilization, not as-is.**

- The **infrastructure and data layer are fundamentally suitable** for the next realistic stage (hundreds to low tens of thousands of listings, a few thousand daily users). One Postgres 17 with a monolith is enough. Nothing I found requires a rewrite or new infrastructure. **[CODE]**
- The **product model is not ready**. Rumia is a student-hostel platform with `apartment`, `short_stay` and a location system added around it. "Premium" does not exist as a concept in the code. Location is modeled (campuses, regions, zones, county/area) but the whole application defaults to DeKUT and Nyeri in 100+ places. **[CODE]**
- The **biggest immediate problem is reliability, not scale**. I found, in code and by execution, several concrete defects that can make signup fail or can make the wrong people admins. The most important is a rate-limiter design flaw that I reproduced. **[RAN]**

Scalability classification: **B. Can scale after stabilization.** The architecture is suitable. Reliability, observability and DeKUT-hardwiring must be fixed first. The data model needs one structural change (section 6) before apartments and premium properties are added at volume, but it is an additive change, not a rebuild.

Final decision: **YELLOW** (section 10).

---

## 2. What is actually broken

Ranked by (user impact × likelihood × severity). Evidence tags as above.

| # | Problem | User impact | Root cause | Evidence | Priority |
|---|---|---|---|---|---|
| 1 | **New Google accounts with "admin" in the email become admin** | Privilege escalation. Anyone can create a Gmail like `x.administrator@gmail.com`, sign in, and get the admin role on first login | DB trigger `on_auth_user_created_profile` on `auth.users` runs `CASE WHEN NEW.email ILIKE '%admin%' THEN 'admin'`. The repo's own replay keeps the trigger alive. | **[RAN]** drove `AuthService._upsert_user` + `_login` against a DB built from `supabase/migrations`: `Kamau.Administrator@gmail.com` → `role='admin'`. File: `supabase/migrations/20260611070823_remove_hardcoded_admin_emails_from_trigger.sql`. **Whether production has this trigger is [UNVERIFIED]** (section 11, check A) | **P0 until check A passes** |
| 2 | **All server-side calls share one rate-limit bucket, so signups can be throttled site-wide** | After about 20 logins in a minute, further sign-ins fail with the generic "Something went wrong while signing you in". The same mechanism caps `/auth/google/start` at 30/min and `/auth/token` (refresh) at 60/min for the *entire site* | Next calls FastAPI server-to-server (`web/src/lib/auth/backend.ts`) and forwards no client IP. `backend/app/core/ratelimit.py` falls back to the socket address, which is the web container (or the VM, if it goes through nginx). Every user looks like one IP. The callback is limited to 20/min | **[RAN]** 40 requests to `/auth/google/start` with no `X-Forwarded-For`: 30 OK, 10 got 429. The callback route has a lower cap (20/min), `backend/app/features/auth/router.py:36`. Impact at your current traffic is **[UNVERIFIED]** | **P0** |
| 3 | **Auth failures are invisible to Sentry** | You cannot see why signups fail. A backend error, a 429, or an unreachable backend all become `redirect /auth/login?error=auth_failed`, logged with `console.error` and (for non-OK only) one PostHog event | `web/src/app/auth/google/callback/route.ts`: the `catch` and the `!result.ok` branches redirect, never throw or report to Sentry. The login page then shows one generic toast for all causes | **[CODE]** | **P0 for diagnosability** |
| 4 | **`www` vs apex host can break the OAuth state check** | Users who arrive on `www.rumia.co.ke` and sign in get "The sign-in session expired" and cannot sign up | The state cookie is host-only (no `domain`), set on whatever host started the flow. The Google redirect URI is fixed to `rumia.co.ke`. Nginx serves both hosts and has no www→apex redirect. Site metadata, sitemap and robots point to **`www`**, so search traffic lands on `www` | **[CODE]**: `app/auth/google/start/route.ts` sets the cookie; `callback/route.ts` compares it; `nginx.conf` has both `server_name`s with no redirect; `layout.tsx` `metadataBase` is `https://www.rumia.co.ke`. Whether Cloudflare redirects www→apex is **[UNVERIFIED]** (check D) | **P1** |
| 5 | **In-app browsers cannot sign in** | WhatsApp, Instagram and Facebook webviews: Google refuses OAuth ("disallowed_useragent"). Rumia links are mostly shared via WhatsApp in Kenya, so this is a large share of first visits | No user-agent detection or "open in browser" guidance. The only mention is a legacy `pkce_failed` toast from the Supabase era that nothing triggers any more | **[CODE]**: `login/page.tsx`; grep for in-app detection finds nothing. Share of affected users **[UNVERIFIED]** (PostHog `google_sign_in_initiated` vs completed) | **P1** |
| 6 | **Rate limit is trivially bypassable from the browser** | Brute-force and spam protection on `/auth/*`, `/leads/track`, tours, reviews, check-email is nominal | `_client_ip` trusts the **first** `X-Forwarded-For` value. Nginx *appends* to a client-supplied header (`$proxy_add_x_forwarded_for`), so the first value is attacker-controlled | **[RAN]** 40 requests with distinct spoofed XFF: 40 OK, 0 throttled. Lead dedupe uses the same IP hash (`leads/router.py`), so lead and commission rows can be inflated | **P1** |
| 7 | **The documented default rate limit (300/min) is not enforced** | None directly, but protection is weaker than the config says | `slowapi` default limits need `SlowAPIMiddleware`, which is not installed. Only routes with `@limiter.limit` are limited | **[RAN]** 320 requests to an undecorated route: 0 throttled | **P2** |
| 8 | **Duplicate emails/push** | Users get duplicate notifications | Cron runs inside every gunicorn worker (4×). `EmailDeliveryWorker.retry_pending` selects `pending/sending/deferred/failed` rows with no claim or `SKIP LOCKED`, so several workers pick the same rows and in-flight sends are retried | **[CODE]**: `core/tasks/cron.py`, `notifications/email_worker.py:177`, `Dockerfile` (`-w 4`) | **P1** |
| 9 | **Bulk contact/payment dataset is public** | Not the contact visibility itself. `GET /public/verify-candidates` returns every active listing's phones, **M-Pesa details** and exact location in one unpaginated call | Built for the Hakikisha checker; no per-item lookup, no rate limit | **[CODE]**: `features/public/router.py`. Contact visibility is intentional. Bulk M-Pesa details are an abuse and fraud-targeting surface (someone can impersonate a listed payee) | **P2** |
| 10 | **Deploys are not gated by CI and cannot roll back** | A broken push reaches production | `cd.yml` has no `needs`/`workflow_run` despite its comment. `deploy.sh` runs no migrations, only warns if the health check fails, and keeps no previous image | **[CODE]** | **P1** |
| 11 | **Tests do not run SQL** | The suite passes while real queries break | All 253 backend tests use mocked DB results (`tests/conftest.py`) | **[RAN]** 253 passed in 8s, without a database | **P1** |
| 12 | **Circular import** | App only boots because `app.main` imports in a lucky order. Any script, worker or test that imports a feature first crashes | `tours/service.py` ↔ `zones/router.py` | **[RAN]** `ImportError: cannot import name 'TourService' ... circular import` | **P2** |
| 13 | **Suspended users keep access** | A suspended account keeps working until its token expires (30 min) and can refresh indefinitely | `AuthenticatedUser.is_active` is never read from the DB. The refresh path does not check account status | **[CODE]**: `core/security.py`, `auth/service.py` | **P2** |
| 14 | **Role resolution fails open to "student"** | Transient DB errors silently downgrade or mis-handle users instead of returning 503 | `_resolve_authenticated_user` has `except Exception: pass` | **[CODE]**: `core/security.py` | **P2** |
| 15 | **JWKS fetch blocks the event loop** | Latency spikes affecting all requests | Synchronous `urllib` call on the async path, only in the legacy Supabase verification branch | **[CODE]**: `core/security.py` `_fetch_jwks`. Dead path now. Remove | **P3** |

Items I looked for and did **not** find: SQL injection (queries are parameterized; the one f-string builds column names from internal keys), unauthenticated admin/manager routes (all gated, including router-level `Depends`), open redirects in the OAuth `next` parameter (`safe_next` is correct), and weak refresh-token handling (rotating tokens with family revocation and reuse detection are well built).

### Noisy / non-actionable and expected failures

I cannot rank real Sentry issues, but the code shows what to expect:

- Any Sentry issue mentioning Supabase predates the cutover and is stale (consistent with your earlier note).
- 429s and 401/403/404 returned as `HTTPException` are not captured by the FastAPI integration as errors, so they will not appear. That is correct for expected failures but also means **rate-limit-driven signup failures leave no trace**.
- `chunk`/`x[y] is not a function` errors after deploys were already addressed in the last two commits (auto-reload and SW cache purge). Expect these to drop.

---

## 3. Signup failure investigation

Signup is **Google OAuth only**. There is no password signup. "Signup" and "login" are the same flow, and a first login creates the account.

### Full trace

1. **User opens `/auth/login`** (`web/src/app/(public)/auth/login/page.tsx`). It runs `hasStoredSessionCookie()`; if a session hint cookie exists it redirects to `/account`. It then fetches the "coming soon campuses" list (failures ignored).
2. **User taps "Continue with Google"** → `signInWithGoogle(next)` (`lib/supabase/auth.ts`, a shim named for Supabase) → browser navigates to `GET /auth/google/start` on the **Next** server.
3. **`app/auth/google/start/route.ts`** calls FastAPI `POST /auth/google/start` server-side (`authBackend.start`). FastAPI (`AuthService.build_google_url`) signs a state JWT and builds the Google URL. Next sets the **host-only** `rumia_oauth_state` cookie (httpOnly, SameSite=Lax, path `/auth/google`, 10 min) and redirects to Google.
   - Failure points: backend unreachable or 429 (see problem 2) → redirect `auth_failed`. In-app browser → Google blocks, Rumia never sees it (problem 5). Start on `www` → cookie bound to `www` (problem 4).
4. **Google returns to `rumia.co.ke/auth/google/callback?code&state`** (the registered redirect URI).
5. **`app/auth/google/callback/route.ts`** checks `cookie == state` (CSRF). Missing cookie → `oauth_state_expired` (problem 4).
6. It calls FastAPI `POST /auth/google/callback` server-side. **Rate limited 20/min for the whole site** (problem 2).
7. **FastAPI `AuthService.google_callback`**: verifies the signed state, exchanges the code with Google (`httpx`, 15 s timeout), fetches Google's JWKS **on every login**, verifies the id token (audience, issuer, nonce, `email_verified`).
   - Failure points: Google error → 401 "Google rejected the sign-in code"; Google JWKS fetch failing → unhandled exception → 500.
8. **`_upsert_user`**: `INSERT INTO auth.users ... ON CONFLICT (email) DO UPDATE`. This fires the `on_auth_user_created_profile` trigger on first insert, which creates the `profiles` row (problem 1). Lookup is by lowercased email, so migrated users keep their ID. **[RAN]** the three test sign-ins (including a case-different re-login) all succeeded and produced one user per email.
9. **`_login`** → `ProfileService.sync_login` → `get_or_create_profile` (defaults the user to the `dekut` campus if the `campuses` row exists), sets `school_verified` from `@dkut.ac.ke`, links guest tour bookings by phone → issues a refresh token (hashed in `auth_refresh_tokens`) and a 30-minute HS256 access token. The DB session commits before the response.
   - Failure points: DB error → 500 (this path **is** reported to Sentry/PostHog via `capture_error("profile_completion_failed")`). If the `dekut` campus row were missing, new profiles would have `campus_id NULL`. In the replayed DB that column is nullable, but a comment in the code says the live DB has `NOT NULL`, which would then 500 every new signup. **[UNVERIFIED]** (check C).
10. **Back in Next**: it calls `profilesApi.syncLoginWithToken` again (the backend already did this, so it is redundant work; its failure is swallowed), then sets three cookies: `rumia_at` (readable by JS), `rumia_rt` (httpOnly), `rumia_s` (hint) and redirects to `next` (or `/account` if profile completion is needed).
11. **Authenticated state**: `proxy.ts` refreshes the access token on each request when it is near expiry, calling `/auth/token` server-side, which is **also rate limited site-wide at 60/min** (problem 2). On a transient failure it keeps the session; on a 4xx it clears cookies and signs the user out, so a 429 from the shared limiter is treated as "refresh token revoked" and **signs the user out** (`proxy.ts`: `else if (result && !result.ok) session = null`). **[CODE]**

### What I can and cannot prove

- **Proven by execution:** the shared-bucket throttle (30 of 40 pass), the spoofable bucket, and the admin-by-email-trigger role assignment in a replayed database. Signup logic itself works end to end against real SQL on a clean DB.
- **Cannot prove which of these is hurting real users.** The two quantities that settle it are the production count of `429` responses on `/auth/*` and the PostHog funnel `google_sign_in_initiated → callback outcome`. Neither is available from here.
- **Most likely causes, in my judgment, ordered by plausibility:** in-app browsers (5), `www` host (4), shared throttle during bursts (2), and then unknown backend errors that are invisible because of (3). Because of (3) there may be failures I cannot even see.

---

## 4. Scalability assessment

Assessed against the stated next stage: roughly 2,000 properties to tens of thousands of listings, several cities, a few thousand daily users.

| Area | Verdict | Reasoning |
|---|---|---|
| **Users** | Fine | Stateless API, 4 workers, pool of 10+20 per worker (120 max connections vs Postgres default 100, **needs a check**). Auth is DB-backed per request (one profile lookup). Fine to low thousands of concurrent users. The shared rate-limit bucket (problem 2) will fail **before** capacity does. |
| **Properties / listings** | Fine to ~50k rows with fixes | Feed query is simple and indexed (`campus_id`, `is_active`, `property_type`, covering feed index, `sort_position`). Each feed page does 4 round trips (listings, selectin agent/images/room types, view counts). Acceptable. |
| **Locations** | Modeled but hardwired | `campuses`, `regions`, `campus_zones`, `county`, `area` exist and are filterable. Not extensible without DeKUT assumptions (section 8). |
| **Search** | Weak, sufficient for now | `ILIKE '%q%'` across title, description, location and area is a sequential scan that grows linearly. At 30k rows it will be tens of ms to low hundreds of ms per query per worker, **not measured**. A GIN `fts` index exists and is unused. A per-process cache of ORM objects for 30 s is inconsistent across 4 workers. Fix with `pg_trgm` or the existing FTS, **not** with Elasticsearch. |
| **Database** | Suitable | One Postgres 17 is correct at this scale. Gaps are integrity, not capacity: no `CHECK` on price, free-text `property_type` and statuses, partial slug uniqueness only, no migration tool, known drift between migrations and live (`DB_MIGRATION.md`). Migrations replay cleanly into an empty Postgres 17: **[RAN]** all 86 applied. |
| **API** | Suitable | Pagination exists on feeds but allows `limit` up to 1000. `/public/verify-candidates` and `/public/sitemap` are unpaginated full scans, fine at 2k rows, painful at 50k. Three different error shapes. |
| **Frontend** | Suitable with debt | ISR for public pages. About 70 files fetch ad hoc in `useEffect`. TanStack Query is installed but used nowhere. Several 1,000+ line components. |
| **Media** | Fine | R2 with processed variants and blur placeholders is the right approach. Image processing runs in the Next process with `sharp`; fine at current upload volume, an operational concern only during bulk onboarding. |
| **Authentication** | Sound design, fragile integration | Refresh-token families, hashing and reuse detection are good. Problems are all at the edges: shared rate limit, host/cookie coupling, in-app browsers, role-from-email trigger, no status check. |

**What would break first under 10× traffic:** the shared auth rate limit (immediately), then search and feed sequential scans, then Postgres connections (4 workers × 30 vs a default `max_connections` of 100), then duplicate notifications and Brevo/Expo cost from the 4× cron.

---

## 5. What already works

Do not rewrite these.

- **Monolith with feature slices** (`backend/app/features/*`). Boundaries are mostly respected and business rules live in services, not routers.
- **Refresh-token design** (`auth/service.py`): hashed tokens, family revocation on reuse, a 10-second grace for concurrent tabs, one-time codes for mobile.
- **OAuth hygiene**: signed state, nonce, `email_verified`, `safe_next`, allow-listed app redirects.
- **DB session lifetime**: the `scope="function"` commit-before-response pattern is documented and tested (`test_db_session_scope.py`).
- **The Supabase→self-hosted migration process**: replay script, dry runs, row-count comparison, restore-tested backups (nightly local and offsite to R2). Migrations replay cleanly.
- **CI guards**: OpenAPI snapshot check, generated mobile types check, the "no direct DB from web" ratchet (now at zero).
- **R2 image pipeline** and key-prefix ownership checks in `ImageService.register_upload`.
- **Authorization**: role gates and object-level checks I inspected were correct (listings, analytics, admin, manager, zones).
- **Chunk-error recovery and service-worker cache hygiene** (latest commits) address a real class of post-deploy failures.
- **Observability foundations exist**: Sentry on both tiers, structured logging, PostHog events on profile failures. The gap is coverage, not tooling.

---

## 6. Property model: is it flexible enough?

**Short answer: not for apartments and premium at volume. It can be evolved additively without a rewrite.**

What exists:

- One flat `listings` table (about 50 columns). `property_type` is a free-text column with default `hostel`; the API documents `hostel`, `apartment`, `short_stay`. **There is no `premium` type or tier anywhere in the code.**
- Hostel-only fields live on every listing: `distance_to_campus`, `distance_category`, `gender`, `bathroom_type`, `room_type_enum` (CHECK-limited to self_contained/bedsitter/single/double/shared), `price_single`, `price_sharing`, `proximity_description`, `pays_commission`.
- Ownership is the `agents` table (with a second ORM model `AgentProfile` on the same table). There is no separate owner/landlord entity; one agent per listing.
- Units: `listing_room_types` (type, price, deposit, availability flag) hangs off a listing. There is no building/property level.
- Short stays: `bnb_details` (1:1 side table with guests, nightly price, stay limits, `available_from/until`) behind a **separate `/bnb` API, separate frontend routes and separate forms**.
- Availability: `is_full` and per-room `is_available` booleans, plus date bounds on bnb. No calendar, which is fine for discovery.
- Pricing: one `price` (monthly in the API description) plus bnb's `price_unit`. Two pricing models are expressed in two places.

Exact limitations:

1. A building with 40 apartments is 40 near-duplicate listings, or one listing with loose room types. Neither supports "show me 2-bedroom units in this building."
2. Short stay is a parallel code path, not a property category. Every cross-cutting feature (search, compare, saved, sitemap, notifications) needs per-type handling. The sitemap, for example, emits only `/hostels/...` URLs and no bnb pages.
3. Premium cannot be represented except as a free-text value.
4. A `campus` is required on every listing and on every profile. An apartment in Westlands has no campus.

Recommended direction (additive, not now): keep `listings` as the public contract, add `property` and `unit` tables behind it, make `category` and `rental_type` constrained enums, move hostel-only attributes into a side table the way `bnb_details` already does, and fold bnb into the same search.

---

## 7. Is the system ready for multiple locations?

**Location is modeled, but the product is hardwired to DeKUT.**

Modeled and usable: `campuses` (slug, city, status active/coming_soon/suspended), `regions`, `campus_zones`, `listings.county/area`, campus-scoped manager roles.

DeKUT/Nyeri assumptions found **[CODE]**:

- `getCampusBySlug('dekut')` is the default campus in the public layout, home page, hostels page, manifest, OG image, agent pages and the verify report (`web/src/app/(public)/layout.tsx:12`, `page.tsx:24,157`, `hostels/page.tsx:52`, `manifest.ts:5`, `api/og/route.tsx:116`).
- `county || 'nyeri'` and `area || 'dekut'` URL fallbacks appear in at least 10 web files and in the sitemap, proxy redirects and email links (`sitemap.ts:26`, `proxy.ts:86`, `email_worker.py`).
- New profiles are defaulted to the `dekut` campus (`profiles/service.py`). School verification is hard-coded to `@dkut.ac.ke` (`SCHOOL_EMAIL_DOMAIN`).
- Overall: 78 web files and 14 backend files reference DeKUT or Nyeri (299 and 35 matching lines).
- Root metadata title and description are "Find Student Hostels Near DeKUT Nyeri".
- A "campus" requires hero headline, WhatsApp number and primary color (NOT NULL), so using a campus as a generic "city" creates meaningless required fields.
- The URL structure `/hostels/{county}/{area}/{slug}` bakes the word "hostels" into every property URL, including apartments and short stays.
- `official_hostels` and the verification workflow ingest DeKUT-specific official records. This is a good wedge feature but is not generalized.

Searchable and filterable: yes by campus, zone, county, area (county and area use `ILIKE`, unindexed). SEO-friendly: partly, the URL scheme and sitemap are hostel-only. Extendable: yes, but each new city currently needs a campus row with branding fields and risks inheriting DeKUT defaults.

---

## 8. Operational readiness for the bulk-add scenario

Scenario: add 500 apartments, 300 premium properties, 1,000 hostels and 500 short stays across several cities (2,300 listings).

**What breaks:**

1. **Premium has no representation.** Premium listings would be stored as `apartment` or `hostel` with no way to filter or present them.
2. **Cities.** Each needs a campus row with required branding, and visitors in other cities would still land on a DeKUT-defaulted experience and URLs.
3. **Short stays** need a separate form, API, search page and moderation path.
4. **Search and sitemap performance** are fine at 2,300 listings (a sequential scan over a few thousand rows is cheap). They are not the first thing to break.

**What nothing breaks but is operationally hard:**

- **Listing creation is one at a time**, via a 1,800-line form. There is no CSV or bulk import in the API (`reorder`/`shuffle` exist for ordering only). 2,300 listings manually is weeks of work.
- **Media**: each image goes through the Next process; no bulk path.
- **Verification** is manual or DeKUT-record-based (`verification.py`), with a fixed `dekut_official_records.json`. It does not extend to new cities without new official datasets or another trust mechanism.
- **Moderation**: reviews have moderation; listings have `manual_review_needed` flags but I found no queue UI beyond the admin tables.
- **Detecting failures**: auth failures are invisible (problem 3), so a growth push could silently lose signups.
- **Backups** are good; **rollback** is not.

---

## 9. The real bottleneck

> **Rumia's main limitation is not database scalability. It is that signup and sign-in reliability cannot be observed, and there are several known ways for it to fail, while the product and URLs are still DeKUT-shaped.**

If I have to name one thing: **the auth layer's integration with the Next server tier** (shared rate-limit bucket, swallowed errors, host-bound state cookie, and the legacy trigger). The second constraint is the single-table hostel-shaped property model.

---

## 10. Final decision

### YELLOW

The architecture is viable. Nothing requires microservices, a search engine, or a rewrite. But the reliability of the front door (signup) is unproven and has at least one proven defect, I cannot see production failures, and one possible privilege escalation must be ruled out today. Do not run a growth push or onboard new cities until section 12 steps 1 to 5 are done.

Separate assessments, as requested:

| Dimension | State |
|---|---|
| **Reliability** | Weak. Critical flow has proven defects and no visibility. |
| **Scalability** | Adequate for the next stage. |
| **Maintainability** | Fair for hostels, poor for new property types and cities (DeKUT hardwiring, parallel bnb path, two models on one table, circular import). |
| **Operational maturity** | Backups and CI guards are good. Detection, gating and rollback are weak. |

---

## 11. Questions and checks that change the conclusions

Only items whose answers change the audit.

### Production checks (I was blocked from SSH; please run these)

Run them yourself with the `!` prefix, or tell me to retry once you have allowed SSH reads in your permission settings.

**A. Is the admin-by-email trigger live?** (decides whether item 1 is a P0 incident)

```
docker exec rumia_postgres psql -U rumia -d rumia -c "select tgname, tgenabled, tgrelid::regclass from pg_trigger where not tgisinternal and tgrelid::regclass::text in ('auth.users','profiles');"
docker exec rumia_postgres psql -U rumia -d rumia -c "select email, role from profiles where role in ('admin','manager') order by 1;"
```

If `on_auth_user_created_profile` exists: drop it (or rewrite it without the `ILIKE '%admin%'`) **and** review every admin in the second query for accounts you do not recognise.

**B. How many auth calls are being throttled?**

```
docker logs rumia_backend --since 24h 2>&1 | grep -c " 429 "
docker logs rumia_nginx   --since 24h 2>&1 | grep '/api/v1/auth' | awk '{print $9}' | sort | uniq -c
```

**C. Live schema vs migrations** (drift noted in `DB_MIGRATION.md`):

```
docker exec rumia_postgres psql -U rumia -d rumia -c "\d profiles" -c "select slug,status from campuses;"
```

**D. Does `www` redirect to the apex?** `curl -sI https://www.rumia.co.ke/auth/login | head -5`

**E. Is the server using the public or internal API URL?**
`docker exec rumia_web sh -c "grep -rl 'backend:8000' .next/server | head -3; grep -rl 'rumia.co.ke/api/v1' .next/server | head -3"`
(Next inlines `NEXT_PUBLIC_*` at build time, so the compose runtime override may not take effect on server code. Either way, server calls share one source IP.)

**F. Postgres connection ceiling:** `docker exec rumia_postgres psql -U rumia -c "show max_connections;" -c "select count(*) from pg_stat_activity;"`

### Questions for you

1. **Sentry**: can you export the top 20 production issues from the last 14 days (title, events, users affected, first seen)? That is the evidence I could not get, and it would replace my "most likely causes" ranking in section 3.
2. **PostHog**: do you have the funnel `google_sign_in_initiated` → logged-in session? The drop-off tells us how many signups fail without an error.
3. **What exactly do users report?** Where do they get stuck: Google screen blocked, bounced back to the login page, or logged in but missing their profile?
4. **Traffic**: roughly how many daily active users and sign-ins per day/peak minute? This decides whether the 20/min callback cap is hit today.
5. **Listings today**: roughly how many active listings, and how many are short stays or apartments? Are they created by agents, admins, or both? Is there any bulk-import intent for new cities?
6. **Cloudflare**: is Cloudflare in front of Nginx (it appears in the CSP)? If so, `X-Forwarded-For` and the real client IP handling need to follow Cloudflare's `CF-Connecting-IP`.

---

## 12. Recommended repair order

1. **Run checks A and B today.** If the trigger is live, remove it and audit admins before anything else.
2. **Fix signup observability**: report every failure branch of `app/auth/google/callback/route.ts` and `proxy.ts` refresh to Sentry with the cause (status, backend error code), and show distinct messages (rate limited, Google rejected, server unavailable). Without this, every later fix is guesswork.
3. **Fix client-IP handling** so rate limits are per real user: the web tier forwards the verified client IP (`X-Real-IP`) to FastAPI; Nginx sets `X-Forwarded-For $remote_addr` instead of appending; FastAPI trusts only that value. Consider raising the `/auth/google/callback` and `/auth/token` caps. Distinguish a 429 on refresh from a revoked token in `proxy.ts` so users are not signed out.
4. **Make `www` and apex consistent**: 301 `www` → apex in Nginx (or set the state cookie `domain=.rumia.co.ke`), and use one canonical host in `metadataBase`, sitemap and robots.
5. **In-app browser handling** on the login page: detect WhatsApp/Instagram/Facebook webviews and show "Open in Chrome/Safari".
6. **Gate CD on CI and add rollback**: `workflow_run` or `needs`, tag the previous image, fail the deploy on a failed health check.
7. **Add a real-Postgres test layer**: a CI Postgres service, fixtures built from the migrations, and tests for signup, refresh families, listings feed and search, the lead and commission flow.
8. **Single-run cron and `SKIP LOCKED` claiming** for email and push deliveries.
9. **Account-status enforcement and fail-closed role resolution** in `core/security.py`; delete the legacy Supabase verification path.
10. **Then the expansion work**: decouple DeKUT defaults (default campus, URL fallbacks, metadata, verification domain), add category and tier concepts including premium, fold bnb into search and URLs, bulk import, `pg_trgm` for search, and a migration tool.

Steps 1 to 6 are days of work, not weeks.

---

## 13. Expansion readiness

| Capability | Current state | Can scale? | Required changes |
|---|---|---|---|
| Hostels | First-class, the original product. Verification, zones, campus routing all built for it | Yes | Reliability fixes (steps 1 to 9) |
| Apartments | Exists as `property_type='apartment'`, same table and hostel-shaped fields; no building or unit hierarchy | Partially | Constrained category enum, unit/property level, hide hostel-only fields, own URL scheme |
| Premium properties | **Not represented**; no tier, type, or presentation | No | Add a category or tier, premium presentation and filtering, trust signals that are not DeKUT-specific |
| RumiaBnB | Real implementation (`bnb_details`, own API, forms, pages) but a parallel path | Partially | Fold into unified search, sitemap, saved and compare; define availability semantics; one pricing model |
| Multiple Kenyan cities | Campuses/regions/zones exist; defaults, URLs, metadata and verification are DeKUT-hardwired | Partially | Remove hard-coded defaults; a lighter-weight "city" or "area" unit; `www`/canonical fixes; city-level SEO pages |
| More users | Architecture fine; signup front door unreliable and unobservable | After fixes | Section 12 steps 1 to 5 |
| More listings | DB and feeds fine to tens of thousands; search is a sequential scan; no bulk import | Yes, with search fix | `pg_trgm`/FTS, pagination caps, bulk import |

---

## 14. What can wait

Useful, but **not** needed to expand reliably:

- Adopting TanStack Query across the frontend (decide use-or-remove, but not urgent).
- Splitting the 1,000 to 1,800 line components, design-system cleanup, bundle trimming (axios, supabase packages, duplicate icon/chart libraries).
- A full Alembic migration history rewrite (a baseline plus a forward-only runner in deploy is enough).
- PostGIS and radius search (until you need "within 2 km").
- Redis, a search engine, a queue, read replicas, multiple databases.
- Making the access-token cookie httpOnly and removing `unsafe-inline`/`unsafe-eval` from the CSP (a good hardening task, not a blocker).
- Reworking `AgentProfile`/`Agent` double mapping, the `official_hostels` generalization, and API versioning policy.
- RumiaRent integration points (future).
- Documentation refresh (README still says Next 14 and Supabase JWT; `.env.example` is stale). Important for onboarding, not for reliability.

---

## Appendix: method and artifacts

- Backend tests: `cd backend && uv run pytest tests -q` → 253 passed (all with mocked DB).
- Rate-limit experiment: in-process ASGI client against the real `app.main`, `AUTH_MODE=custom`, 40 calls to `/auth/google/start` (no XFF vs distinct XFF) and 320 calls to an undecorated route. Results: 30 OK / 10 429; 40 OK / 0; 320 OK / 0.
- Signup experiment: `AuthService._upsert_user` and `_login` run against a throwaway `postgres:17-alpine` container built via `scripts/db-replay-migrations.sh` (86 migrations applied cleanly). Results: normal user → `student`; `Kamau.Administrator@gmail.com` → `admin`; case-different re-login reused the same user. The container has been removed.
- Not executed: seeded query timings, browser journeys, mobile viewport tests, production inspection, Sentry review.

---

# Addendum (2026-10-05): production evidence and signup root cause

After the audit above, read-only access to the production VM was approved. Everything here was read from production (`rumia_nginx` access logs for the last 7 days, `rumia_web` logs, and read-only SQL against `rumia`). Nothing on the server was changed. Server code revision: `d8c91b6` (same as `main`).

## Root cause of failed Google sign-in: proven

**100% of sign-ins that started on `www.rumia.co.ke` fail on the first attempt with `oauth_state_expired`.** Sign-ins that start on the apex `rumia.co.ke` succeed.

Evidence (nginx logs, merged timeline per client):

```
04 08:54:17  GET /auth/google/start     referer www.rumia.co.ke   (x2, x3 duplicates)
04 08:54:27  GET /auth/google/callback  -> 307
04 08:54:28  GET /auth/login?error=oauth_state_expired            <- FAIL
04 08:54:37  GET /auth/google/start     referer rumia.co.ke       (retry, now on apex)
04 08:54:42  GET /auth/google/callback  -> GET /account 200       <- SUCCESS
```

The same sequence repeats for every failing attempt (04:42, 04:45, 06:32, 11:10 on 4–5 Oct). The failure page lands the user on the apex, they tap again, and the retry succeeds. Anyone who does not retry is lost.

Mechanism:

- The OAuth state cookie `rumia_oauth_state` is **host-only**. Google's redirect URI is fixed to `https://rumia.co.ke/auth/google/callback` (`GOOGLE_REDIRECT_URI`), so the callback always arrives on the apex.
- A sign-in started on `www` stores the cookie on `www`. The browser does not send it to the apex. The CSRF check in `app/auth/google/callback/route.ts` then fails.
- `www` is not redirected: `curl -I https://www.rumia.co.ke/auth/login` returns 200 (Cloudflare proxies both hosts and nginx serves both). `NEXT_PUBLIC_APP_URL` is unset in production, so metadata, canonical, sitemap and robots default to `https://www.rumia.co.ke`, which is why search results and shared links send users to `www`.
- Traffic by referer host over 7 days: 2,517 requests from `www` vs 1,420 from the apex (64% on `www`).

A second, separate defect makes it worse: the **old service worker (v5, still live in production) fires duplicate `/auth/google/start` requests**. In the logs 24 of 33 start requests carry `Referer: https://www.rumia.co.ke/sw.js`, i.e. they were issued by the worker itself, in bursts of 2 or 3 within one second. Each one overwrites the state cookie with a different value. The worker intercepted full-page navigations before its own auth exclusions ran (`public/sw.js`, v5).

## Corrections to earlier sections of this report

| Earlier claim | What production shows |
|---|---|
| "Admin-by-email trigger may be live (P0 until verified)" | **Not live.** `pg_trigger` on `auth.users` and `profiles` contains only `trg_ensure_notification_preferences`. The 8 staff accounts (2 admin, 6 manager) are all expected. The one email containing "admin" (`adminqueenmin@gmail.com`, created July) is a student. The repo replay still creates the trigger, so a fresh environment built from the migrations would be vulnerable. Remove it from the migrations. |
| "Shared rate-limit bucket may be throttling signups (P0)" | **Not the cause at today's volume.** Signups are 1–4 per day, 32 `/auth/google/start` calls in 7 days, zero 429s seen. It remains a latent defect that will bite at roughly 20 logins per minute. |
| "Backend errors may be hiding signup failures" | Backend is healthy: 1 error line in 7 days, all key endpoints return 200. The failures happen before the backend is reached (state-cookie check in Next). |
| "Server-side Next calls use the internal URL" | **They go through the public URL and nginx**: `POST /api/v1/auth/google/start|callback` and `/profiles/me/sync-login` appear in the nginx access log. `NEXT_PUBLIC_API_BASE_URL` is inlined at build time. |
| "`profiles.campus_id` NOT NULL drift [UNVERIFIED]" | **Confirmed.** It is `NOT NULL` in production and nullable in the repo's migrations. `home_campus_id`, `home_campus_confirmed_at`, `phone` and `home_campus_name` are nullable in both. |

## Profile completion: how big is the problem

Of 918 student profiles, **407 (44%) are incomplete** (no phone or no confirmed home campus): 218 have neither, 189 have a phone but never confirmed a campus, 0 have a campus but no phone, 511 are complete.

| Signup month | Students | Incomplete |
|---|---|---|
| 2026-06 | 21 | 20 |
| 2026-07 | 128 | 106 |
| 2026-08 | 644 | 196 |
| 2026-09 | 119 | 84 |
| 2026-10 (to the 5th) | 6 | 1 |

Interpretation: the profile-completion fixes shipped around 10 Sept and the cutover on 1 Oct clearly helped (5 of 6 October signups completed). The backlog is mostly older accounts that never returned or dismissed the modal. Of 33 students who signed in during the last 14 days, 22 are still incomplete, so returning users are not being prompted effectively or are failing to save.

Backend `PATCH /profiles/me` works: reproduced end to end against a schema built from the migrations, and the production logs show profile calls returning 200.

Related production findings:

- `Failed to find Server Action "x". This request might be from an older or newer deployment.` appears 12 times in 7 days. The old profile save used a Server Action, so any tab open across a deploy failed with a generic error. Fixed by moving the save to a direct API call.
- `Failed to fetch campus by slug (Nyeri View | Near Gate A | Boma | ...)` : 404 appears about 150 times in 7 days. The `/hostels/[county]/[area]` page and `manifest.webmanifest` look up a **campus** by what is actually a zone/area name, produce a 404 from the API on every render and flood the logs. Not user-visible but noisy and wasteful. Open item.
- Probing traffic is constant (`/.env`, `/.git/config`, `/index.php`, `/cgi-bin/...%2e...`): all 404 or 400. No evidence of compromise, expected internet noise.

## What was changed in the repository (not yet committed or deployed)

Profile completion:

- `web/src/lib/api/profile-save.ts` (new): direct `PATCH /profiles/me` from the browser, retries offline/429/502-504, classifies errors into user-actionable messages, reports to Sentry only for real server faults. Replaces the Server Action (`app/actions/profile.ts` deleted); both the completion modal and the settings tab use it.
- `web/src/app/account/page.tsx`: a failed `GET /profiles/me` now retries once and shows a banner with Retry. It no longer falls back to an empty profile that showed the blocking modal to every user.
- `backend/app/features/profiles/service.py`: a typed campus that is not in the registry now clears the default DeKUT `home_campus_id` instead of leaving the student pinned to DeKUT (verified against real Postgres).

Sign-in host and service worker:

- `nginx/nginx.conf`: 301 `www.rumia.co.ke` → `rumia.co.ke` (path and query preserved); HTTP redirects straight to the apex in one hop. Validated with `nginx -t` and a behavioural test (www → 301, apex proxied, ACME path not redirected).
- `web/src/app/auth/google/start/route.ts` and `web/src/lib/auth/origin.ts` (`canonicalRedirectFor`): defence in depth, bounces a `www` start to the canonical host before any cookie is set.
- Metadata, canonical, sitemap and robots fall back to `https://rumia.co.ke` (15 occurrences across 11 files) so Google consolidates on the same host. If `NEXT_PUBLIC_APP_URL` is later set on the server it overrides this.
- `web/public/sw.js` (v6): never touches `/auth/*`, `/account`, `/dashboard`, `/admin`, `/manager`, `/saved`, `/api/*` (including navigations), no 20 s abort, public pages kept (max 40) and served only when the network fails or exceeds 8 s, `no-store`/`private` pages never stored, static cache capped at 300 entries, old caches purged on activation. `ServiceWorkerRegister` checks for updates on every visit and no longer force-reloads during sign-in or forms.
- `proxy.ts` and `app/auth/refresh/route.ts`: a 429/5xx on token refresh no longer clears cookies or signs the user out; only 400/401/403 do.

Verification: web 187+ tests (including 26 new for the save helper, the service-worker routing as shipped, the refresh classifier and the canonical-host helper), `tsc` and `eslint` clean; backend 255 tests (2 new).

## Deploy notes and follow-ups

1. Deploy normally (push to `main`; `deploy.sh` restarts nginx, which picks up the new config). The new service worker replaces v5 on each user's next visit; expect the old duplicate-start pattern to disappear from the nginx logs within a day.
2. After deploy, confirm in the logs: no `Referer: .../sw.js` on `/auth/google/start`, no `www` hits reaching Next (they should be 301), and `oauth_state_expired` trending to ~0. Check `docker logs rumia_nginx --since 24h | grep oauth_state_expired`.
3. Expect a one-off SEO effect: `www` URLs 301 to the apex and canonical tags change to the apex. Submit the apex sitemap in Search Console. If you would rather make `www` canonical, the alternative is to change `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_SITE_URL` and the Google Cloud OAuth client to `www`, which I did not choose because the apex is what is registered today.
4. Remove the `on_auth_user_created_profile` trigger from the repo's replay path (or add a migration that drops it) so rebuilt environments do not inherit the admin-by-email rule.
5. Reconcile the `profiles.campus_id NOT NULL` drift in the migrations.
6. Fix the zone-as-campus 404 lookups on `/hostels/[county]/[area]` and `manifest.webmanifest`.
7. Still open from the audit: IP trust for rate limiting (latent), cron running once per worker, CD not gated on CI.
8. To recover the 407 incomplete profiles, a gentle re-prompt on next visit is already in place (the modal shows until completed or dismissed in the session). Consider an in-app banner for the 189 users who have a phone but never confirmed a campus.
