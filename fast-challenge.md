# Rumia FastAPI Migration — Architectural Challenge (Pre-Commit Review)

> **Purpose:** Stress-test the recommended architecture (in `fast.md`) against the *actual* codebase before committing. Each recommendation is challenged, and where the audit was vague or wrong, this document corrects it. All 10 questions are answered **definitively**, grounded in the real code (verified during the read-only audit).
>
> **Status:** READ-ONLY analysis. No implementation. Nothing deployed.

---

## Challenge 1 — "FastAPI → SQLAlchemy direct to Postgres" vs "FastAPI → Supabase APIs"

### What the audit proposed
FastAPI connects directly to PostgreSQL via SQLAlchemy (async, asyncpg) through the Supabase transaction pooler, and Postgres stays managed by Supabase.

### The challenge
Direct SQLAlchemy is right for **reads, transactions, and complex queries**, but **two concrete technical facts in the actual code force a hybrid, not a binary choice**:

1. **`auth.uid()` is embedded in RLS policies across 20 migration files.** A direct connection authenticates with the **database password as `postgres.…` (effectively superuser)**, so `auth.uid()` returns NULL and *every* `auth.uid()`-based policy is dead for that connection. Any object FastAPI writes must be authorized in code — the DB won't stop it.

2. **Many privileged operations today *deliberately* bypass RLS via `service_role`.** These are not edge cases; they are the admin/manager/notification backbone:
   - Admin CRUD on any listing/agent/user/profile (`admin.ts`).
   - Role promotion, agent creation via `auth.admin.createUser`, cross-user notifications (`app_notifications` insert is service-role-only by design).
   - Manager cross-user writes (approve applications, update agent status, moderator review deletion).
   - Student "fee field protected from tamper" writes (`hostel_requests.updateMyHostelRequestAction` uses service-role *on purpose*).
   - Analytics RPCs (`get_admin_*`, `get_platform_view_summary`, `get_popular_listings`) are SECURITY DEFINER — they bypass RLS by design.

A pure PostgresREST/RLS-driven FastAPI **cannot express these**, because they cross the "own row" RLS boundary. So the "direct SQLAlchemy" choice is unavoidable for the privileged path — **but it is not required (nor ideal) for the user-facing path.**

### Definitive answer
**Use a hybrid, split by operation class:**
- **User-facing reads + own-data writes** (student/agent: listing view, search, own listing CRUD, reviews own rows, saved hostels, notifications own): keep going through **Supabase PostgREST with RLS** (either from Next during transition, or from FastAPI via an authenticated Supabase client per request). This preserves RLS as a **real** security layer for the highest-volume, lowest-trust surface — see Challenge 2.
- **Privileged operations + anything needing transactions/joins/functions** (admin, manager, role changes, notifications-to-others, commissions, transfers, ordering RPCs, view/analytics RPCs): **direct SQLAlchemy**, with **explicit, tested code-level authorization** — exactly replicating today's service-role + `checkManagerCampusScope`/`isAdminUser` pattern.

**Bottom line:** The audit's "direct only" is half the story. Rejecting Supabase APIs entirely would *discard* RLS for the very traffic (public/student reads) where RLS is strongest and where you get defense-in-depth for free. Keep a **PostgREST/RLS tier** for user-facing data and use **SQLAlchemy** for the privileged/business tier.

---

## Challenge 2 — "Can RLS be a genuine security layer, or are we abandoning it?"

### What the audit said (vague/wrong)
It leaned on "authorization moves into FastAPI code… we keep RLS as defense-in-depth" — effectively **abandoning RLS for FastAPI**.

### The challenge
That framing is too weak. There is a **real, supported mechanism** to make RLS a genuine layer for direct connections: setting `request.jwt.claims` per transaction.

```sql
SET LOCAL request.jwt.claims = '{"sub": "<user-uuid>", "role": "authenticated", "email": "..."}';
```

After this, `auth.uid()` and the RLS policies **work** inside that transaction as if the user had connected via PostgREST with their JWT. This lets FastAPI execute user-scoped queries *through the existing RLS* instead of re-implementing every `USING`/`WITH CHECK` expression in Python.

### The catch (why it can't be the *only* layer)
- The connecting DB role must be **`authenticated`** (not the superuser `postgres`) for claims to map to real RLS. But FastAPI also needs **service-role-equivalent** power for privileged ops — you cannot be both `authenticated` (RLS applies) and service-role (RLS bypassed) on one pooled connection without resetting, and letting a single role set arbitrary `sub` claims **is itself a privilege-escalation risk** (any compromised request = act as any user → full RLS bypass). So claims-setting must be **tightly wrapped, per-request, short-lived (SET LOCAL = transaction-scoped), and never available to user-input-driven code**.
- Today's service-role operations **cannot** be expressed through RLS no matter what (they deliberately break it).

### Definitive answer
**Yes, RLS can be genuinely preserved — for the tier where it belongs — and no, we are not "abandoning" it. We are being explicit about its contract:**

- **Keep RLS as the authoritative boundary for the user-facing tier** (public + authenticated student/agent data, own-row writes, manager campus-scoped reads). FastAPI serves these through **RLS-enabled paths** (either PostgREST with the user's JWT, or direct with `SET LOCAL request.jwt.claims` set to the *verified* JWT claims only).
- **Do not pretend RLS covers the privileged tier.** For admin/manager/notification/role/moderation operations — which the codebase already routes through service-role *by design* — authorization is **code-level**, enforced by porting `isAdminUser`, `getManagerUserContext`, `checkManagerCampusScope`, `is_manager_of_campus`, owner-equality checks, and the state-machine guards into FastAPI services, **and tested with a mandatory authorization matrix** (Challenge: this test suite is the non-negotiable replacement for the RLS safety net on the privileged tier).
- **Defense-in-depth rule:** every FastAPI endpoint must declare its tier. User-facing → RLS-backed. Privileged → code-authz backed **and** an explicit review that the operation legitimately crosses RLS. A bug in a privileged handler must not be masked by "RLS would have caught it" (it wouldn't — that's the whole point of service-role).

---

## Challenge 3 — "How exactly should Supabase JWTs be validated by FastAPI?"

Verified from the code: the token is **HS256**, signed with the project's **JWT secret**; payload claims are `{iss: "supabase", ref: "<project>", role: "anon|authenticated", sub: <user uuid>, aud, iat, exp}` (decoded header/payload confirmed during audit).

### Definitive answer
1. **Algorithm:** verify with `HS256` only (reject `alg: none`/`RS*` — enforce `ALGORITHMS=["HS256"]`).
2. **Secret:** the project **JWT secret** (Supabase Dashboard → Settings → API → JWT Secret). Store it in the VPS env; never commit.
3. **Claims to check on every request:**
   - signature valid (HS256, secret),
   - `exp` not passed,
   - `iss == "supabase"`,
   - `ref == "pjqgtypojpnnvonuzuzj"` (your project ref),
   - `role == "authenticated"` (reject `anon` for protected endpoints),
   - extract `sub` = the user UUID.
4. **Authorize (not just authenticate):** from `sub`, load `profiles.role` and `managed_campus_id`/`managed_region_id` to build the request's auth context (iad/via the same logic today's `getManagerUserContext`/`isAdminUser` use). Cache this lookup briefly (e.g. 30–60s) per `sub` to avoid a DB hit on every request.
5. **Refresh handling:** Supabase access tokens are short-lived. Return **`401`** on expired/invalid token; the *client* (web via `@supabase/ssr`/middleware, or mobile via `supabase.auth.refreshSession()`) refreshes and retries. FastAPI stays stateless — it never issues tokens. Do **not** embed a refresh flow in FastAPI.
6. **Library:** use a maintained lib (`python-jose` or `PyJWT`). Keep the verify/refresh logic behind one `auth.py` service with unit tests (valid, expired, wrong-role, wrong-ref, tampered).

This is **identical in intent to today's flows** — it just replaces "Supabase says who you are" with "FastAPI independently verifies the same token." No session/cookie coupling, so it works for web *and* mobile with no changes to how tokens are minted.

---

## Challenge 4 — "How should web and mobile auth work without breaking existing users?"

No existing session needs to be invalidated. Supabase already mints the access token for every user (700+/day); we only change *where it's consumed*.

### Definitive answer
- **Web (existing users):** The Next app already holds the Supabase session in cookies (`sb-<ref>-auth-token`, PKCE). **For the transition, web keeps using Supabase cookies and Server Actions** (flag-gated). When a route flips to FastAPI, Next sends `Authorization: Bearer <access-token>` obtained from the existing session (via `supabase.auth.getSession()`/the server client). No user re-login; no cookie format change; no password reset.
- **Mobile (new):** mobile performs Supabase login (Google native flow or email), stores the session, sends the access token as a Bearer header to FastAPI directly. No Next cookies at all.
- **Shared contract:** both clients submit the *same* Supabase-issued JWT; FastAPI validates it the same way (Challenge 3). Therefore **web and mobile are auth-equivalent** from FastAPI's perspective — this is the property that makes the backend "mobile-ready."
- **Migration safety for existing users:** because web keeps using Supabase sessions throughout (only the *consumer* of the token changes), the OAuth PKCE, refresh rotation, and the profile-creation trigger (`on_auth_user_created_profile`) are **untouched**. The risk that "700 users get logged out" is contained to a bug in the new *token-forwarding* code — which is covered by e2e login tests and a canary before any route flips.
- **Do not** build parallel sessions, cookie-to-FastAPI bridging, or a second token store. One auth source: Supabase; one token: the Supabase access token.

---

## Challenge 5 & 6 — "How should the 77 migrations be handled, and who owns future migrations?"

### Facts from the code
- 77 forward + 19 rollback SQL files under `supabase/migrations/`, tracked in git, managed by the Supabase CLI (`supabase db push` / `db reset`). There is **no CI config, no `supabase db push` script, and no `seed.sql`** — today migrations appear to be applied manually by a developer. Project Postgres 17.
- The schema is held together by RLS policies referencing `auth.uid()` and SECURITY DEFINER functions — i.e., **deeply Supabase-coupled** (auth schema, `is_*` helper functions, `auth.admin` API usage in code).

### Definitive answer
**Phase 0 caveat — do NOT introduce Alembic as a second migration authority yet.**
- **Single source of truth stays: `supabase/migrations/` (Supabase CLI) for the entire transition.** Because the schema is RLS/Supabase-coupled and both Next (via Supabase) and FastAPI (direct) share the same DB, having **two concurrent migration tools (Supabase CLI + Alembic)** would create version drift and destructive-`autogenerate` risk on a live DB. That is a real liability in the proposed plan.
- **FastAPI does not own migrations during transition.** It reflects the existing schema (read-only `Base.metadata.reflect()` or hand-written models matching it) to talk to the DB, but **does not `alembic autogenerate`**.
- **When ownership can transfer (post-cutover, only after the schema is decoupled from Supabase):** convert Supabase CLI migrations to Alembic in a **fully additive, batched** way, and only after decommissioning the Supabase-REST/RLS-dependent paths and moving the `auth.*` helper set into FastAPI-compatible form. Until then, any schema change is authored as a normal Supabase migration (additive), versions stay in sync, and FastAPI's models are updated to match.
- **Concrete rule:** one author, one tool, one versioned history (the git-tracked CLI migrations) until the app proves it no longer needs Supabase-specific schema features. Switching tools is itself a migration phase, not a prerequisite.

---

## Challenge 7 — "Exactly what should remain in Supabase vs move to FastAPI?"

### Definitive answer (by capability, grounded in the code)

**Remain in Supabase (keep as managed):**
- **Auth:** Google OAuth + PKCE + refresh + JWT minting + `auth.users` + `on_auth_user_created_profile` trigger. (Challenge 3/4.)
- **PostgreSQL (data):** all 34+ business tables stay in Supabase Postgres. Keep RLS policies (they still protect the Supabase-REST path and Next's direct access).
- **RLS security functions** (`is_campus_super_admin`, `is_manager_of_campus`): keep in DB — FastAPI calls them (Challenge 2) and Next still uses them through PostgREST.
- **pg_cron `archive-listing-views`** (+ probabilistic trigger): keep — it lives with the data and already works; no need to move to a VPS worker.
- **RPC functions** (`get_listing_view_counts`, `track_listing_view`, `get_popular_listings` campus-scoped, `get_review_summary`, `reorder_listings`, `shuffle_listing_order`, analytics `get_*`): keep in DB; FastAPI calls them via SQLAlchemy `func`/`text`. Reuse over reinvention.

**Move to FastAPI (the business/service layer — today's Server Actions):**
- Authorization **enforcement** for privileged ops (port `isAdminUser`, `getManagerUserContext`, `checkManagerCampusScope`, owner/state-machine guards) — FastAPI services.
- Business rules: listing CRUD, reviews submit/moderation + audit log, agent applications + cooldown, tours status machine + server-side pricing (`getZoneTourPrice`), leads + commission calc (10%-or-KSh-1000) + `commission_balance` update, WhatsApp message/link building, hostel-request fee protection, DeKUT offline verification matcher, legal-doc sanitization, listing ordering math.
- Push fan-out (`sendPushToUser`, admin/manager target resolution) + subscription management.
- PostHog event capture from server actions (move client-agnostic capture to FastAPI; keep browser capture in Next).
- Image-upload metadata & presigning (Challenge 9) and **orphan cleanup/deletion** (missing today).

**Stay in Next.js (frontend concern):**
- UI, PWA, ISR/SEO, `/ingest` PostHog proxy, react-query-less rendering, `revalidatePath`/cache usage, browser-side maps, compare, saved hostels UI.

**Leave with Cloudflare:** R2 object storage + CDN, `pub-….r2.dev` public URLs.

---

## Challenge 8 — "Oracle VPS vs Vercel/Cloudflare/Supabase — what runs where?"

| Concern | Where | Rationale |
|---|---|---|
| **FastAPI (Uvicorn)** | **Oracle VPS** | Your stated goal; central API for web + mobile. |
| **Nginx + TLS** (reverse proxy, gzip, size limits, rate-limit headroom) | Oracle VPS | Front the API; terminate TLS (Let's Encrypt). |
| **Background worker** (push fan-out, image orphan sweep, any queueable job) | Oracle VPS | Not on Vercel; serverless functions have timeout limits that break long pushes. |
| **Redis** | Oracle VPS | **Optional, start OFF** — only if rate limiting across workers or a queue is needed. Don't add it speculatively. |
| **Next.js (frontend)** | **Vercel** (assumed; confirm) | Frontend/PWA/ISR/SEO stay put — keeps downtime low and preserves SEO. |
| **PostgreSQL** | **Supabase (managed)** | Data safety (backups, HA) >> self-hosting on a single VPS. |
| **Supabase Auth** | **Supabase (managed)** | Auth continuity; Challenge 3/4. |
| **R2 + CDN** | **Cloudflare** | Object store; serve images from CDN. |
| **PostHog** | PostHog EU (managed) | Analytics; keep `/ingest` proxy on Next, or direct from mobile. |
| **Google OAuth / Maps** | External | Key-based, unchanged. |
| **pg_cron archive** | Supabase | Lives with data; already working. |

**VPS is stateless.** Nothing on the VPS holds live data that isn't in one of the managed services → restore = redeploy image + env; DB/R2/Secrets/Bankups are managed elsewhere.

---

## Challenge 9 — "How do we migrate each domain without breaking production?"

The audit listed phases. The challenge is nailing the *mechanism* so nothing breaks. Concrete, code-grounded plan:

### Mechanism: feature-flag router + single-writer-per-domain + shadow reads
1. **Feature flag per domain** (env-driven, e.g. `USE_FASTAPI_LISTINGS`, `USE_FASTAPI_REVIEWS`). Reads check the flag and choose old (Server Action/Supabase) vs new (FastAPI) path **per request**. No deploy needed to flip → instant canary + rollback.
2. **Single writer per domain at any moment.** Never run Server Action writes and FastAPI writes for the *same* domain simultaneously (avoids split-brain). Flip reads first; validate parity via **shadow/dual-read** (both code paths return results, compare externally, only serve the winner); then flip writes behind the flag; then disable the old write path.
3. **Order by risk, not convenience (verified against the code):**
   - **Phase 0:** FastAPI foundation — config, structured logs, request-ID, `/healthz`/`/readyz`, JWT auth middleware, CI, Docker, **test scaffolding + authorization matrix harness**.
   - **Phase 1 (low risk, read-only):** public listings read + search snapshot + campuses/zones/regions **read**. Shadow-parity against `/hostels`. This is where you prove the read path + campus scoping before any write.
   - **Phase 2 (low risk):** reviews **read** + listing detail (slug) + room types read.
   - **Phase 3 (auth bridge, HIGH):** Next starts forwarding the Supabase token to FastAPI for the migrated routes; **mobile login works end-to-end**. E2E login test mandatory. (Highest-risk single step: any token-forwarding bug could tool out logins — but it's isolated to the new forwarder because Supabase sessions are untouched.)
   - **Phase 4 (HIGH):** listings **write** (create/update/toggle, room types, image metadata) on FastAPI.
   - **Phase 5 (HIGH):** reviews **write + moderation + audit log**; likes/replies.
   - **Phase 6 (HIGH):** agents + applications + profile completion.
   - **Phase 7 (HIGH, money bookkeeping):** leads + commissions + tours + WhatsApp link building on FastAPI.
   - **Phase 8 (HIGH, most authz surface):** admin & manager domains (roles, campus scope, transfers, legal, zones, campus settings, announcements, requests).
   - **Phase 9:** analytics + view tracking + archive (via kept DB functions).
   - **Phase 10:** push/notifications/feedback + worker.
   - **Phase 11 (cutover):** Next drops Server-Action business code → frontend-only; mobile fully on FastAPI; **decommission** the now-unused paths.
   - **Post:** consolidate service-role, orphan sweep, Redis rate-limit (if needed), Sentry, OpenAPI→TS client wired into Next.
4. **No dual-writes** anywhere. Every migration only ever has **one** codebase writing each table per window, so a rollback never leaves two sources of truth.
5. **DB stays shared + additive** throughout; no destructive DDL during transition → rollback of any phase is just flipping the flag (old path resumes) with no data migration.

### Rollback per phase
Flag flip → old Server Action path serves again → no schema rollback needed (additive-only policy) → Docker image pinned by SHA → `docker compose up <prev-tag>`. Backups restored only as a last resort via Supabase managed restore.

---

## Challenge 10 — "What must change BEFORE migration because it's a current liability?"

These are **pre-existing problems** that would become worse if we ported them into FastAPI as-is. Fix them first (each is low-risk and independent of the migration).

### Pre-migration hardening (do before/early in Phase 0–1)
| # | Liability (code-verified) | Fix |
|---|---|---|
| **P1 (Security, HIGH)** | Legacy presign upload endpoint `POST /api/upload` — **no MIME/size validation, unsanitized filename, arbitrary Content-Type** → upload abuse / object pollution. | Kill it; keep only the validated `/api/upload-url`. *(Quick, do first.)* |
| **P2 (Security, HIGH)** | **No image deletion / no orphan cleanup** — `deleteFile` defined but never called; R2 objects + `image_uploads` rows accumulate forever. | Add delete flow + nightly orphan sweep; remove image metadata rows when replaced. |
| **P3 (Security, HIGH)** | **Production logger is a no-op** (`logger.error` does nothing in prod; most code uses `console.error`) → no audit trail, silent failures. | Wire a real structured JSON logger with request IDs + error tracking (Sentry) in the new stack; add audit-log calls for moderation/transfers/role changes (currently only some are logged in DB). |
| **P4 (Security, MED)** | **In-memory, unbounded rate limiter** — not shared across instances; IP-carded maps never evicted (leak); abusable on multi-instance. | Redis-backed (or at least bounded + shared) rate limit when >1 worker. |
| **P5 (Security, MED)** | **`commissions` create/paid run on the RLS client while every other admin write is service-role** — inconsistent auth model; easy to get wrong during port. | Normalize before porting: one explicit pattern per tier (Challenge 2). |
| **P6 (Security, MED)** | **`get_popular_listings` SECURITY DEFINER omits campus scoping** if the caller omits `p_campus_id` → cross-campus data exposure via API. | Ensure FastAPI always passes campus scope; add a code guard. |
| **P7 (Arch, MED)** | **Search is fully client-side over a 24h ISR snapshot**; `fts`/GIN index unused; payload grows with listings. | Before/with Phase 1, stand up a FastAPI read endpoint + cache invalidation on write (the audit's key perf liability). |
| **P8 (Arch, MED)** | **Service-role key used in ~30 files** (actions, routes, server components) — high blast radius. | Consolidate service-role access behind the backend; stop importing it into server components as migration proceeds. |
| **P9 (Arch, LOW)** | Duplicate PostHog server singletons (`posthog-server.ts` vs `posthog.ts`); `og` purpose silently falls through to listing variants; `OG_VARIANT` unused. | Clean up while porting logging/analytics. |
| **P10 (Arch, LOW)** | No CI for DB migrations (manual apply); no staging DB for integration tests. | Add CI + a staging Postgres (Supabase `db reset` / separate project) for the authorization test matrix. *(Enables the whole migration's test strategy.)* |

### Why before migration?
Every one of these is **currently true** and would be **silently copied into FastAPI** if we port the Server Actions verbatim (P1–P6 are code patterns that would carry over). Fixing them first means FastAPI inherits the *corrected* behavior, not the bug — cheaper than porting then fixing.

---

## Consolidated verdict on the original plan
- **Keep:** Supabase Postgres **managed** (data safety) — agreed.
- **Keep:** Supabase **Auth** (token stays the auth source) — agreed, formalized in Challenge 3/4.
- **Correction 1 (Challenge 1/2):** The plan said "FastAPI talks directly, drop Supabase API/RLS." **Wrong as stated.** Keep an **RLS-preserving user-facing tier** (PostgREST or `SET LOCAL request.jwt.claims`) and reserve direct SQLAlchemy for the privileged tier. RLS is a **genuine** layer for the tier it belongs to, not "just defense-in-depth."
- **Correction 2 (Challenge 5/6):** The plan suggested Alembic migration ownership early. **Premature.** One migration authority (Supabase CLI) through the transition; Alembic only post-decoupling, additively.
- **Correction 3 (Challenge 9):** The plan's phase list is fine but must be gated by the **feature-flag + single-writer + shadow-read** mechanism, and Phase 3 (auth bridge) is the true high-risk gate, not Phase 11.
- **Call-to-action (Challenge 10):** Land **P1–P10** (especially P1, P2, P3) **before** porting anything — they are live liabilities that must not be carried into the new backend.

---

## Open decisions still needed from you
1. Confirm Next.js currently on **Vercel** (or where) — affects Challenge 8 (only FastAPI moves to Oracle).
2. Confirm **Supabase Postgres stays managed** (recommended YES).
3. Confirm **Supabase Auth stays** (recommended YES) — the highest-leverage call.
4. Web-to-FastAPI path: **direct `api.rumia.co.ke`** (mobile-first, recommended) vs a short Next proxy shim. Recommend direct with a proxy shim during transition.
5. Staging DB available for the authorization test matrix? (Required for the migration to be test-driven.)
6. Are you OK doing **P1–P10 hardening first** before Phase 0, or want them merged into Phase 0/1?

*This is a decision-support document; nothing has been implemented or deployed.*
