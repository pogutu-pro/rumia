# Rumia Mobile — Architecture & Final Implementation Plan (2nd Audit)

> **Status: PLANNING ONLY. IMPLEMENTATION: NOT STARTED.**
> This is the single source of truth for Rumia mobile architecture and decisions.
> `fast.md` (`docs/internal/fast.md`) is the FastAPI migration journal — mobile content lives here, not there.
> Second independent audit performed 2026-08-29 against the working tree (branch `migration/fastapi`).

---

## 1. Second Audit Summary

Independent re-verification of the repository (not inherited from prior plans). Key verified facts:

| # | Fact | Status |
|---|---|---|
| 1 | `/mobile/` is **empty** — no Expo, no config, no code | CONFIRMED |
| 2 | `fast.md` moved to `docs/internal/fast.md`; still internally inconsistent (header: Phase 4 in progress; §4 table: Phase 4 COMPLETE @63/63). §12 only documents through Phase 3 — migration journal is stale relative to committed code | CONFIRMED |
| 3 | Committed history: Phases 4 (18 domains), 5 (files/jobs/integrations), 6 (monorepo + Docker) exist as commits. **Large uncommitted working-tree work in progress**: CI/CD, Sentry (web+backend), Oracle VPS deployment guide, web serer-action strangler → FastAPI | CONFIRMED |
| 4 | **CI/CD now exists** (was absent at first audit): `.github/workflows/ci.yml` (backend pytest 77 tests + web `tsc` + `pnpm build` + docker compose build), `cd.yml` (SSH → Oracle VPS → `deploy.sh`) | NEW |
| 5 | **Deployment target confirmed = Oracle VPS** (Johannesburg `af-johannesburg-1`, ARM64), via `docs/DEPLOYMENT.md`, docker-compose, nginx, deploy.sh. Vercel assumption is obsolete | NEW |
| 6 | **Sentry adopted** in web (`@sentry/nextjs`, withSentryConfig, client/server configs, `global-error.tsx`) and backend (config + `_init_sentry()` in `main.py`) | NEW |
| 7 | Web strangler progressed: `actions/listings.ts` (and profile/reviews/feedback/tour-bookings/announcements actions) now delegate to `web/src/lib/api/*` (FastAPI). DeKUT verification logic moved to backend (`backend/app/features/listings/verification.py`) | NEW |
| 8 | Backend: Sentry settings, `DEBUG` parser fix, listings `toggle-active`/`toggle-commission` endpoints added; tests now **77** (was 63) | NEW |
| 9 | **No saved-listings API** in FastAPI (grep = 0). Web still writes `saved_hostels` directly via Supabase in `save-button.tsx` (unchanged) | CONFIRMED |
| 10 | **No native push-token API.** Notifications API is Web-Push (VAPID) only; `worker.py` queries/updates nonexistent `push_subscriptions.is_active` → dispatch broken as written | CONFIRMED |
| 11 | `SUPABASE_JWT_SECRET` **EMPTY** in `backend/.env` → `security.py` falls back to hardcoded dev secret | CONFIRMED |
| 12 | Production HTTPS **not live**: `nginx/nginx.conf` 443 block has no `ssl_certificate` directives; `scripts/init-letsencrypt.sh` added but not executed | CONFIRMED |
| 13 | Profile API exposes campus fields only; `full_name/phone/avatar_url/updated_at` exist in DB but not in `ProfileRead` | CONFIRMED |
| 14 | Tours/leads/commissions ownership filter `agent_id == user.id` — `agents.id` ≠ `profiles.id` → agents get empty lists (unchanged, no diff) | CONFIRMED |
| 15 | Search: FastAPI `/search` is generic ILIKE; `listings_fts` GIN still unused; no sort/distance/amenity filters | CONFIRMED |
| 16 | Error envelope `{error:{code,message,details}}`; web `client.ts` still parses `.detail || .message` (mismatch, unchanged) | CONFIRMED |
| 17 | **`web/.env.production` is untracked and NOT covered by `.gitignore`** — contains live secrets (service-role key, R2 keys, Google secret, VAPID private, Sentry auth token). High leak risk on first commit | NEW / CRITICAL |
| 18 | nginx now rate-limits `/api/v1/` at 30 r/s (burst 20) | NEW |
| 19 | docker-compose binds web/backend to 127.0.0.1; adds build-arg `NEXT_PUBLIC_API_BASE_URL=https://rumiamanage.com/api/v1` | NEW |

---

## 2. Confirmed Current Architecture

```
          ┌────────────────────────────────────────────┐
          │            FastAPI /api/v1  (Oracle VPS)   │  ← central app authority
          │  18 vertical-slice features, 77 pytest     │     Supabase JWT bearer, HS256
          └───────┬───────────────────┬────────────────┘
                  │                   │
        ┌─────────▼────────┐   ┌──────▼─────────┐
        │  Next.js Web/PWA │   │ React Native   │ ← EMPTY. Future client.
        │  supabase-JWT    │   │ supabase-JWT   │
        └──────────────────┘   └────────────────┘
        PostgreSQL (Supabase)   Supabase Auth    Cloudflare R2/CDN  PostHog  Sentry
```

- **Auth:** Supabase Auth source of truth. Web uses `@supabase/ssr` cookies + server PKCE exchange; mobile (future) uses supabase-js + secure-storage session; **both present the same Supabase access token** to FastAPI. FastAPI never mints tokens; it resolves identity from `sub` and authorization role/scope from the `profiles` table.
- **Roles:** `student | agent | manager | admin` (DB CHECK constraint; function names `is_manager_of_campus`, `is_campus_super_admin`). Campus isolation must never weaken.
- **DB:** Supabase-managed PostgreSQL 17, RLS enabled everywhere, Supabase CLI sole DDL authority (77+ migrations; no Alembic during transition).
- **Contract:** `/api/v1` prefix; `{error:{code,message,details}}` errors; `{items,total,page,limit,pages}` pagination; OpenAPI at `/api/v1/openapi.json`.

---

## 3. Web Reuse / Adaptation Analysis (feature logic audit)

For every meaningful functional area: implemented? where? how reused by mobile?

| Product area | Implemented in web | Logic location | Web→FastAPI today? | Reuse class | Mobile decision |
|---|---|---|---|---|---|
| Auth (Google/PKCE/email) | Yes | `lib/supabase/*`, middleware, `/auth/callback` | N/A (Supabase) | **C** | Rebuild with supabase-js + system browser PKCE (no cookies, no Next) |
| Campus selection/onboarding | Yes | URL path + `POST /profiles/me/campus` | ✅ (FastAPI) | **B** | Adapt: explicit persisted `home_campus_*` from `/profiles/me`; server-authoritative |
| Home (popular, announcements, campus picker) | Yes | Server components + data fns | ⚠️ partial (`lib/data/campuses.ts`, `announcements.ts`) | **C** | Rebuild UI; consume `/campuses`, `/announcements`, feed default-sort |
| Hostel feed | Yes | `(public)/hostels` + ISR + feed | ✅ `GET /listings` | **C** | Rebuild with paginated/infinite query |
| Search + NLP parsing + filters | Yes | `lib/search/client-search.ts`, `parse-query.ts`, `filter-store` (Fuse) | ⚠️ `/search` exists but basic | **D→B** | **Move relevance/NLP parsing to FastAPI** (port `parse-query.ts` + scoring to Python). Mobile calls `/search` with structured params. Do NOT ship Fuse in mobile |
| Listing detail, gallery, room types, amenities, reviews summary | Yes | `listing/[slug]`, components | ✅ FastAPI | **C** | Rebuild native (expo-image gallery, R2 variants) |
| Saved listings | Yes | **Supabase `saved_hostels` direct** (`save-button.tsx`, saved tab) | ❌ NO FastAPI endpoint | **D** | **Backend work first** (new `/profiles/me/saved` + `is_saved`). Mobile consumes API |
| Reviews write (8 categories) | Yes | `reviews.ts` action → FastAPI + composer | ✅ FastAPI | **B** | Rebuild composer UI; **reuse `review-categories.ts` categories/weights** (pure data) |
| WhatsApp contact + gating + lead | Yes | `use-gated-whatsapp`, `api/track-lead`, `lib/utils/phone.ts` | ⚠️ FastAPI `leads/track` exists; **message building is web-side today** | **B/D** | **Move message builders (`phone.ts`)** into FastAPI `leads` service; mobile calls `leads/track`; gating logic rebuilt natively |
| Book a Tour (zones, pricing, status) | Yes | app routes + actions + `api/tour-bookings` | ✅ FastAPI `tours` (create/status) | **B** | Rebuild form; pricing from `/zones`. **Student "my tours" list + agent filter fix = backend P0** |
| Profile completion | Yes | `actions/profile.ts`, completion modal | ✅ `/profiles/me` (+campus) | **B** | Adapt; **needs `full_name/phone/avatar` in API** |
| Reviews moderation, listings CRUD, agents, managers, admin consoles | Yes | actions + admin/manager/dashboard pages | ✅ FastAPI (admin, agents, reviews, listings) | **E (V1)** | **Not in mobile V1.** Web/admin stay. (Agent mobile later, only after ownership bug fixed) |
| Announcements | Yes | data + components | ✅ FastAPI | **C** | Rebuild feed UI in Home |
| In-app notification inbox | Partial | actions + push API | ✅ FastAPI (`/notifications`) | **C** | Rebuild; add unread count/pagination (P1 backend) |
| Native push | Web-Push only | `lib/push.ts`, subscribe/unsubscribe | ⚠️ FastAPI web-push endpoints | **D** | **Backend work**: device-token API + fixed dispatch; mobile registers via `expo-notifications` |
| Image upload/process | Yes | `api/images/process`, `lib/image`, `lib/r2` + FastAPI `images/upload-url` | ⚠️ presign in FastAPI; processing in Next | **B** | Mobile compresses client-side → presigned PUT direct to R2 → attach URL via listing create/update. Ensure no bytes through VPS |
| Image delivery | R2 CDN + variants | `next.config` loader + `pub-….r2.dev` | ✅ static | **A/B** | Reuse variant-URL convention (`thumb/card/gallery/large/blur`); `expo-image` caching |
| Listings view analytics | Yes | `listing-view-tracker` → RPC + FastAPI `analytics/track-view` | ✅ FastAPI | **B** | Rebuild tracking (once per listing/session); fire `track-view` |
| Feedback | Yes | action + components | ✅ FastAPI | **B** | Rebuild form in Profile |
| Compare tray | Yes | `compare-store` (Zustand) | client-only | **E (V1)** | **Not in V1** |

### Reuse classification (A–E)

- **A — DIRECTLY REUSABLE (pure TS/domain, copy into mobile `utils/` or share pkg):**
  - `web/src/lib/review-categories.ts` (8 categories + weights)
  - `web/src/lib/utils/phone.ts` phone normalization + WhatsApp message templates (COPY, but **plan to relocate to backend** for lead-message authority — see D)
  - Kenyan-phone validation regex (from `actions/profile.ts`)
  - `web/src/types/index.ts` as reference for generated API type mapping
  - URL/canonical listing shape (`/hostels/{county}/{area}/{slug}`) for deep links
- **B — ADAPTABLE (logic retained, browser APIs swapped):**
  - Campus-selection persistence (→ `/profiles/me` + `/profiles/me/campus`)
  - Contact gating flow → native auth gate + `leads/track`
  - Image variant selection → R2 URL + `expo-image`
  - Analytics/LTT event shapes → `posthog-react-native` with same event registry
  - Tour booking fields/pricing source (`/zones`)
- **C — REIMPLEMENT natively (UI/UX):** all screens/components, gallery, filter sheet, bottom sheets, gestures, loading/empty/error states, toasts.
- **D — SHOULD REMAIN BACKEND (or move there):**
  - Search relevance/NLP parsing (move `parse-query.ts` → FastAPI)
  - WhatsApp message building (move `phone.ts` builders → FastAPI `leads` service)
  - Push fan-out & subscription lifecycle (FastAPI worker; broken → fix)
  - Verification pipeline (already moved to backend `verification.py`) ✅
  - Tour pricing & statuses, commission accrual, popular ordering, review moderation, role/campus authz (already FastAPI) ✅
- **E — DO NOT CARRY FORWARD:** unvalidated `/api/upload`, duplicate zone taxonomy (`dekut-areas.ts` vs `campus_zones`), DeKUT-only copy, `lib/supabase/public.ts` service-role footgun, `@react-oauth/google` dead code, Next cookie-based session handling (mobile uses secure storage), compare tray for V1.

**Shared code decision:** do **not** create a shared `packages/` workspace yet. Only candidate that earns sharing long-term is API types/schemas generated from FastAPI OpenAPI (via codegen), and even that can be committed per-repo initially. Rationale: web and mobile have different build tooling; a monorepo workspace adds complexity with no near-term value. Revisit only when mobile + web both consume a generated client routinely.

---

## 4. FastAPI Mobile-Readiness Analysis

| Capability | Endpoint exists? | Complete? | Mobile needs | Required work |
|---|---|---|---|---|
| Auth (session) | Supabase + FastAPI JWT verify | ⚠️ secret empty | bearer `${access_token}` | **P0** set real `SUPABASE_JWT_SECRET` (prod), consider strict `iss/aud` |
| Profile | `/profiles/me`, patch, `/me/campus` | ⚠️ | name/phone/avatar | **P0** expose `full_name`, `phone`, `avatar_url`, `updated_at`; avatar upload via images + profile attach |
| Listings read | feed, detail by id/slug | ✅ | pagination, filters | feed `limit` cap policy (100); add `is_saved` flag |
| Listings write | CRUD + toggles | ✅ | — (agent UI later) | verify ownership tests |
| Search | `/search` | ⚠️ | real filters + sort | **P1** structured filters (gender/room-type/amenity/distance), sort, FTS relevance, deterministic order |
| Saved listings | ❌ | ❌ | save/un-save/list + `is_saved` | **P0-1** `GET/POST/DELETE /api/v1/profiles/me/saved`; no DDL (table exists) |
| Reviews | list/summary/create/update/delete/like/reply/moderate | ✅ | my reviews | **P1** `GET /reviews?mine=true`; category data reused |
| Tours | create (anon OK), status update | ⚠️ | student "my tours" | **P0** fix `agent_id` filter; add student list via `linked_user_id` |
| Leads/WhatsApp | `leads/track`, commissions | ⚠️ | contact/lead capture | **P0** fix agent filter; **P1** move message builders into service |
| Notifications inbox | list 50, read, read-all | ⚠️ | unread badge, pagination | **P1** cursor pagination + unread count |
| Native push | ❌ (web-push only) | ❌ | device token register/receive | **P0** `POST/DELETE /notifications/devices`; **P0** fix `worker.py` `is_active` + FCM/EAS transport |
| Images upload | `images/upload-url` presigned | ⚠️ | client compress → direct PUT | add attach + delete/orphan (P1); processing optional |
| Images delivery | R2 CDN variants | ✅ | variant URLs + cache | none (use `blur_data_url`-style placeholders) |
| Analytics views | `analytics/track-view`, counts | ✅ | view tracking | none |
| Announcements | list (active) | ✅ | home feed | none (add pagination only if large) |
| Feedback | create | ✅ | profile feedback | none |
| Legal | terms/privacy | ✅ | settings links | none |
| Errors | `{error:{code,message}}` | ⚠️ | client map | document envelope; web `client.ts` fix; mobile parses `error.code` |
| Rate limiting | nginx 30r/s (global) | ⚠️ | auth/user-level limiter | **P1** app-level limiter on auth/leads/track-view/feedback |
| API versioning | `/api/v1` only | ✅ | stable contract | never break; OpenAPI codegen gate |
| HTTPS base | proxy exists, **TLS off** | ❌ | public https | **P0** run `init-letsencrypt.sh`; verify 443 |

---

## 5. Approved Technology Stack (final)

| Choice | DECISION | WHY | IMPACT on Rumia |
|---|---|---|---|
| Mobile framework | **React Native via Expo SDK (latest stable, New Architecture)** | Android-first + future iOS from one TS codebase; managed tooling removes native-build ops burden for a small team; aligns with existing React/TS skill set. Flutter/Kotlin rejected: new language, same team ramp-up | One codebase; EAS handles signing/build/OTA |
| Development platform | **Expo (managed) + EAS Build/Update/Submit** | Simplest path to Play/App Store; no bare-native maintenance for V1 | Operations stay lean |
| Language | **TypeScript (strict)** | Continuity with web; OpenAPI codegen interop | Shared mental model |
| Navigation | **Expo Router** (file-based) | Next.js App Router mental model; built-in deep linking | Fast to build; linking config mirrors web URLs |
| Server state | **TanStack Query v5** | Cache/retry/dedupe/infinite pagination; web-already-uses it | Predictable data layer |
| Client state | **Zustand v5 (restricted to session + campus prefs)** | Tiny; server data never in Zustand | Avoids global-state sprawl |
| Forms | **React Hook Form** | Web-already-uses; native-friendly | Reusable form patterns |
| Validation | **Zod** (schemas derived from OpenAPI where possible) | Runtime safety on the mobile client; web uses zod@4 | Contract-aligned payloads |
| API | **fetch wrapper in `lib/api`** + **OpenAPI-generated types** (`openapi-typescript` from `/api/v1/openapi.json`) | Single contract source; keeps drift in check (CI gate) | Types always match FastAPI |
| Authentication | **Supabase Auth — Google OAuth via PKCE in SYSTEM browser** (`expo-auth-session`), plus email/password | Same JWT as web; system browser avoids the documented WebView PKCE failure; `web/auth` no change | auth-equivalent clients; secure-store session |
| Secure storage | **`expo-secure-store`** (Android Keystore / iOS Keychain) | Tokens must never be in AsyncStorage/plain | Only session material is stored |
| Images | **`expo-image` + R2/CDN variants**; uploads: client compress (`expo-image-manipulator`) → `POST /images/upload-url` → **direct PUT to R2** → URL in listing payload | No image bytes through VPS; matches web contract | Fast galleries; cheap |
| Notifications | **`expo-notifications`**; tokens → **new FastAPI device-token API**; delivery FCM/APNs via **Expo Push/EAS** | One provider integration; product events fire from FastAPI | Backend P0 required |
| Deep linking | **Expo Router linking**; scheme `rumia://` + universal/app links; map `hostels/:county/:area/:slug` → listing | Share URLs work app↔web↔WhatsApp/QR | V1.1 polish, no web change |
| Analytics | **PostHog** (`posthog-react-native`, same project) | Existing EU PostHog; event registry parity with web | Consistent funnels |
| Crash reporting | **Sentry** (`@sentry/react-native` via `sentry-expo`) | **Web + backend already adopted Sentry** — one console | Release tagging via EAS |
| Maps | **V1: geo-link only** (`geo:`/Google-Maps URL) | No SDK/key/quota in V1; coordinates sparse | Defer interactive maps |
| Testing | **Jest + React Native Testing Library** (unit/component), **Maestro** (E2E device flows) | Lightweight, RN-native, low maintenance | Real release confidence |
| CI/CD | **GitHub Actions** (existing workflows extended with mobile jobs) + **EAS Build/Update/Submit** | CI/CD infra now exists; add mobile jobs | PR-gated mobile checks |
| Distribution | **Google Play: internal → closed → staged production**; iOS planned later via EAS | Progressive risk; real users at DeKUT | Version/hardening discipline |

---

## 6. Mobile Product Scope

### V1 (locked — narrow, high-value)
Login (Google + email) · campus onboarding (skipable, server-persisted) · Home (announcements + popular) · Explore zones → paginated feed · server search + filter sheet (gender, room type, price, zone) · listing detail (gallery/room types/amenities/reviews summary/agent) · save/un-save (needs P0-1) · reviews read + write · WhatsApp contact (gated; `leads/track`) · Book a Tour (anonymous or authed) · profile (name/phone/home campus) · in-app notifications inbox · feedback · terms/privacy · deep-link opens listing URL (fallback to web) · view-tracking + analytics.

### Post-V1 (V1.1 / V1.2)
Native push delivery · interactive maps (`expo-maps`/`react-native-maps`) · improved offline (cached last feed/saved-offline) · agent mobile dashboard (after ownership bug + production soak) · share/QR polish · personalization.

### Web/admin only / NOT required
Admin & manager consoles (stay web) · agent listing CRUD (V1 stays web) · compare tray · PWA/ISR concerns · payment execution · chat.

---

## 7. Mobile Architecture (structure)

Feature-oriented with thin Expo Router `app/` routes (mirrors backend vertical slices; survives growth):

```
mobile/
├── app/                  # Expo Router routes: (auth)/, (tabs)/, listing/[slug], book-tour, notifications
├── features/
│   ├── auth/             # PKCE sign-in, session store adapter, auth gate
│   ├── campus/           # campus/zones queries + campus preference
│   ├── listings/         # feed, detail, gallery, cards
│   ├── search/           # search form, filter model, server query
│   ├── saved/            # saved queries/mutations
│   ├── reviews/          # summary/list/composer
│   ├── tours/            # Book a Tour form/mutation
│   ├── notifications/    # inbox + device-token registration
│   └── profile/          # profile query/form/feedback
├── components/ui/        # design-system primitives
├── lib/api/              # fetch client + generated types + Zod
├── lib/supabase/         # client + PKCE helpers + secure-store adapter
├── lib/storage/          # secure-store wrapper
├── lib/posthog.ts · lib/sentry.ts · lib/analytics-events.ts
├── stores/               # Zustand: session, campus (only these)
├── types/ · hooks/ · utils/ · assets/ · tests/
├── app.config.ts · eas.json · package.json
└── .github workflows bind to CI (mobile jobs)
```

State model: TanStack Query = all server data; Zustand = session + selected campus; RHF = forms; AsyncStorage = harmless prefs only (seen-flags); secure-store = tokens.

API flow: screen → query/mutation → `lib/api` client → inject `Bearer’ (secure store) → on 401 refresh once (supabase) → retry → HTTPS FastAPI → `{error:{code,…}}` mapped to UX. Retry: GETs exponential (1–2) via Query; mutations no auto-retry. Timeout ~15s. Pagination: infinite query by page.

Security (mobile is NOT trusted): FastAPI authoritative for all authz/business; no secrets in app (only `EXPO_PUBLIC_*` public values); tokens in secure-store only; HTTPS-only transport; deep-link target allow-list; backend enforced on every `/{id}` (IDOR guard); nginx + app-level rate limits; sensitive logging redaction in Sentry/PostHog.

---

## 8. Mobile API Requirements

Para table in §4 is the full capability matrix — the **V1 gating requirements are**:

- **P0 (must exist before V1 device builds):** saved-listings API + `is_saved`; device push registration + fixed dispatch; real `SUPABASE_JWT_SECRET`; profile `full_name/phone/avatar`; student my-tours + agent filter fix; public HTTPS (TLS).
- **P1 (before/around V1 launch):** search filters/sort/relevance; error-envelope → web & mobile parity; unread/pagination for inbox; app-level rate limiting; image delete/orphan sweep.
- **Explicitly NOT required for V1:** payment callback, geo/maps endpoints, moderation UIs, agent/admin endpoints.

---

## 9. Environments

| Env | Backend | Mobile | Web |
|---|---|---|---|
| Development | local `uvicorn` + local Supabase/DB | Expo dev build → `EXPO_PUBLIC_API_BASE_URL=http://<LAN>:8000/api/v1` | `next dev` with `NEXT_PUBLIC_API_BASE_URL` local |
| Staging | same production backend (owner decision 2026-08-29: no separate staging infra) | EAS `preview` → prod API | n/a |
| Production | VPS behind nginx TLS, `https://rumiamanage.com/api/v1` | EAS `production`, prod URL | same prod API |

`EXPO_PUBLIC_API_BASE_URL` per EAS profile. Public keys only in env; no runtime secrets.

---

## 10. Infrastructure (mobile)

Dev: Expo Go/dev-client on physical Android + emulator. Builds: `eas build -p android --profile preview|production`. Updates: `eas update` for JS-only hotfixes (no native config changes). CI: extend existing GitHub Actions with `mobile` job (typecheck, lint, unit tests, OpenAPI drift check). Distribution: Google Play internal (team) → closed (DeKUT beta) → staged production. Monitoring: Sentry (health), PostHog (behavior), EAS (build). iOS deferred; EAS-ready.

---

## 11. Testing Strategy

- **Unit (Jest):** schemas, client error mapping, utils (phone/price/date), query-key factories, stores.
- **Component (RTL):** cards, filters, save (optimistic rollback), forms, gallery, loading/empty/error states.
- **Integration (Jest, mocked fetch):** 401→refresh→retry, infinite pagination, deep-link → route.
- **E2E (Maestro, physical Android):** install→login→campus→search→open→save→contact; tour booking; expired-session; offline/retry; 5xx; deep link; push deny→inbox.
- **Backend contract:** existing pytest extended for P0 endpoints (saved + devices) incl. authz matrix; OpenAPI drift gate in CI.

---

## 12. Final Phased Implementation Plan

### PHASE 0 — Backend / API Readiness
**Objective:** erase the verified blockers so device builds are safe.
**Dependencies:** none new; additive to existing FastAPI (Supabase CLI = DDL authority; no Alembic).
**Work (ordered):**
0.1 Saved-listings API (`GET/POST/DELETE /api/v1/profiles/me/saved`, `is_saved` on `ListingRead`) + tests.
0.2 Device push: migration `device_tokens` (additive), `POST/DELETE /notifications/devices`, fix `worker.py` (is_active), add FCM/Expo-Push transport stub. Event scope (owner, 2026-08-29): **Listings + Reviews + Messages only** — new listing in subscribed campus, review on my listing, message to my inbox. Tours/leads excluded.
0.3 Set real `SUPABASE_JWT_SECRET` in `backend/.env` + prod; kill dev fallback path.
0.4 Profiles: expose `full_name/phone/avatar_url/updated_at`; avatar upload endpoint.
0.5 Fix tours/leads/commissions ownership filter (compare via agents.user_id).
0.6 Student "my tours" list.
0.7 Shared/app-level rate limits on sensitive routes.
0.8 Export contract: OpenAPI snapshot; add mobile drift job to CI; standardize `RETRY-AFTER`, error codes.
0.9 TLS: provision certs (`scripts/init-letsencrypt.sh`), verify `https://rumiamanage.com/api/v1/health`.
0.10 **[Security]** gitignore `web/.env.production` before anything is committed.
**Files/Areas:** `backend/app/features/{profiles,listings,notifications,tours,leads}/`, `supabase/migrations/`, `.github/workflows/ci.yml`, `.gitignore`, `nginx/`, `scripts/`.
**Testing:** new pytest per endpoint incl. ownership/campus authz matrix; cargo-cult n/a — full suite 77+ must stay green.
**Completion criteria:** saved & device endpoints green with tests; JWT secret non-empty in prod config; health over HTTPS `200`; no secrets in git index.
**Risks:** DB via service-role misuse in new code (use code-authz pattern); TLS provisioning failure (manual fallback documented).
**Rollback/Safety:** additive migrations only; new endpoints flag-gated; deploy.sh pinned-image rollback; no web behavior change (web still uses Supabase saved until Phase 4 flag flip).

### PHASE 1 — Mobile Foundation
**Objective:** `mobile/` scaffolds, typechecks, launches on device, talks to real API.
**Dependencies:** Phase 0.1, 0.8 (contract + drift gate), 0.10.
**Work:** `create-expo-app` (TS, Expo Router template); `lib/api` client + generated types from OpenAPI; `lib/supabase` + secure-store adapter; `lib/storage`; providers (QueryClient, theme, PostHog, Sentry); design-system primitives; `app.config.ts` (scheme `rumia`), `eas.json` profiles, env files; Jest+RTL bootstrap; CI mobile job.
**Files/Areas:** whole `mobile/` (new).
**Backend dependencies:** stable OpenAPI; `/campuses` public.
**Testing:** unit (client/errors), smoke fetch on device.
**Completion criteria:** fresh build fetches `/campuses` on emulator + physical device.
**Risks:** Expo SDK/Go version drift; R2/HTTPS trust in dev (use LAN/dev URL, not prod).
**Rollback/Safety:** no touch to web/backend.

### PHASE 2 — Authentication & User Foundation
**Objective:** sign in/out, session persistence, refresh, onboarding campus, profile.
**Dependencies:** Phase 1; Phase 0.4 (profile fields).
**Work:** login screen (Google PKCE via system browser + email), session store ↔ secure-store, 401→refresh interceptor, auth-gate routing, campus picker (server-persisted), profile screen (name/phone/home campus/feedback/logout).
**Files/Areas:** `mobile/features/auth|profile|campus/`, `mobile/app/(auth)/`, `mobile/stores/`.
**Backend dependencies:** `profiles/me` (+fields), `/profiles/me/campus`, `/campuses`.
**Testing:** unit (interceptor), Maestro login.
**Completion criteria:** fresh install → Google login → campus set → profile reflects `home_campus_confirmed`.

### PHASE 3 — Core Rumia Experience
**Objective:** discovery equivalent of web for students.
**Dependencies:** Phase 2; Phase 0.1 (`is_saved` optional here).
**Work:** Home (announcements, popular, zone chips), Explore zones → paginated feed (infinite query), search screen + filter sheet, listing detail (gallery/R2 variants, room types, amenities, agent, reviews summary + list), view tracking.
**Files/Areas:** `mobile/features/listings|search|campus/`, `mobile/app/(tabs)/`, `mobile/app/listing/[slug].tsx`.
**Backend dependencies:** `/listings`, `/search`, `/zones`, `/announcements`, `/reviews`, `/analytics/track-view`.
**Testing:** components (cards, filters, gallery), Maestro journey.
**Completion criteria:** full discovery loop from cold start on device.

### PHASE 4 — User Actions
**Objective:** V1 actions that write data.
**Dependencies:** Phase 3; Phase 0.1, 0.4–0.6.
**Work:** save/un-save (optimistic, API-backed), reviews composer (8 categories from reused data), WhatsApp contact (gated → `leads/track`), Book a Tour form (authed/anon), incorporate web-strangler flag flip (web `save-button.tsx` moves to FastAPI API).
**Files/Areas:** `mobile/features/saved|reviews|tours/`.
**Backend dependencies:** saved API; `/reviews`; `/leads/track`; `/tours`; student my-tours.
**Testing:** optimistic-rollback unit; Maestro journeys; contract parity (web ends direct-Supabase saved after flip).
**Completion criteria:** complete V1 student loop working on device + web parity for saved.

### PHASE 5 — Mobile-Native Capabilities
**Objective:** device-specific behavior.
**Dependencies:** Phase 4; Phase 0.2 (push API + dispatch), Phase 0.9 (TLS).
**Work:** native push permission flow + token registration/rotation/logout unregister; notification inbox (unread badge); deep linking: app links + `rumia://`, map `hostels/:county/:area/:slug` → listing, fallback web; sharing intent.
**Files/Areas:** `mobile/features/notifications/`, `mobile/app.config.ts`, linking config.
**Backend dependencies:** device-token API; inbox pagination/unread (P1).
**Testing:** Maestro deep-link; manual push on device (background/foreground); token rotate/prune.
**Completion criteria:** web share URL opens app; triggered event arrives as push.

### PHASE 6 — Production Hardening & Play Release
**Objective:** ship V1.
**Dependencies:** Phase 5; Phase 0.7/0.8; Phase 1.1 search upgrade (P1) if feasible.
**Work:** offline/caching policy tuning (stale-time, retry, failure states), performance (image sizes, feed virtualization), a11y, Sentry release wiring + PostHog event audit, security re-review, EAS preview/closed testing intake, Google Play listing (privacy/data-safety), internal→closed→staged rollout (1%→10%→50%→100%), versionCode strategy + OTA discipline.
**Files/Areas:** `mobile/` all; Play Console; `eas.json`.
**Backend dependencies:** rate limits live; error contract finalized.
**Testing:** full Maestro device matrix; 10-day beta with no P1 crashes.
**Completion criteria:** V1 live in production at staged rollout with monitoring.
**Risks/Rollback:** Play store review delay; data-safety mislabel — pre-submit checklist. Rollback = Play staged rollout retreat + OTA revert; API backward-compatible so old clients keep working.

---

## 13. Dependency Map

```
FASTAPI MIGRATION (Phases 1–6 mostly done; P0 gaps open)
        ↓
API CONTRACT STABILITY (OpenAPI + codegen + drift gate)
        ↓
MOBILE FOUNDATION ──┬── (parallel: web strangler completes; design tokens; EAS/CI)
        ↓           │
AUTHENTICATION      │
        ↓           │
CORE MOBILE FEATURES
        ↓
PRODUCTION HARDENING
        ↓
GOOGLE PLAY
```

Parallel-safe: Phase 1 scaffold, design system, lib/api client, CI mobile jobs, web client.ts error fix, web saved API adoption preparation.

---

## 14. Master Execution Sequence

1. `backend`: saved-listings API + `is_saved` + tests (Phase 0.1).
2. `backend`: device-token push API + dispatch fix + additive `device_tokens` migration (0.2).
3. `backend` + ops: real `SUPABASE_JWT_SECRET`; remove dev fallback (0.3).
4. `backend`: profile fields + avatar upload (0.4).
5. `backend`: ownership-filter fix (tours/leads/commissions) + student my-tours (0.5/0.6).
6. `backend`: shared rate limits (0.7).
7. Contract: OpenAPI snapshot + drift gate in CI (0.8); **`gitignore web/.env.production` before any future commit** (0.10).
8. Ops: run `init-letsencrypt.sh`, verify HTTPS health (0.9).
9. `mobile`: Phase 1 foundation (scaffold, lib/api+types, design system, CI job, EAS config).
10. `mobile`: Phase 2 auth + onboarding + profile.
11. `mobile`: Phase 3 discovery (home/explore/search/detail).
12. `mobile`: Phase 4 user actions (save/reviews/contact/tour).
13. Web: flip saved-path to FastAPI; fix `client.ts` error parse (in parallel, before 14).
14. `mobile`: Phase 5 push + deep links + inbox.
15. `mobile`: Phase 6 hardening → internal → closed → staged Play production.

**Next action for a future AI:** start at step 1 (Phase 0.1) — implement `GET/POST/DELETE /api/v1/profiles/me/saved` + `is_saved` on `ListingRead`, using existing `saved_hostels` (no DDL), with ownership/campus authz tests.

---

## 15. Risks & Blocker Summary

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| 1 | TLS not live → no HTTPS for devices | Blocker | Phase 0.9 before any device build |
| 2 | `SUPABASE_JWT_SECRET` empty → dev fallback in prod | High | Phase 0.3; verify prod config |
| 3 | `web/.env.production` unignored secrets | High | Phase 0.10 immediately |
| 4 | Missing saved + device-push APIs | High | Phase 0.1/0.2 first |
| 5 | Agents' ownership filter (empty lists) | High (later) | Phase 0.5; gate agent mobile behind fix |
| 6 | Push dispatch broken (`is_active`) | High | Phase 0.2 |
| 7 | Search quality (ILIKE) | Med | Phase 1.1/Post-V1 FTS |
| 8 | Error-envelope mismatch (web+new mobile) | Med | normalize + codegen |
| 9 | `fast.md` internal inconsistency / stale | Med (docs) | reconcile during Phase 0 |
| 10 | Contract drift | Med | OpenAPI generate + CI drift gate |

---

## 16. Unresolved / Requires Verification
- **Android applicationId + Play brand — OWNER, currently TBD-before-EAS.** Plan proceeds through Phase 0 without it; Phase 1 (`eas.json` + `app.config.ts` android.package) and Phase 6 (Play credentials/listing) block on owner supplying `applicationId` (e.g. `ke.co.rumia.app`), package/display name, and Play Console org. Recorded as an open input, not a risk.
- ~~API subdomain~~ **RESOLVED (2026-08-29): reuse `https://rumiamanage.com/api/v1`** for V1 — nginx already proxies and rate-limits `/api/v1/` (30 r/s burst 20); no new DNS/TLS. `api.rumiamanage.com` deferred until V2 if needed.
- ~~Staging backend/database~~ **RESOLVED (2026-08-29): use existing production backend for development.** Phase 0 must close auth/read-paths (0.1 saved, 0.3 JWT secret) before any device hits it. No staging infra work.
- ~~Push event scope~~ **RESOLVED (2026-08-29): push notifies Listings + Reviews + Messages only.** Phase 0.2 migration + `worker.py` dispatch model exactly these categories; tour/leads events excluded until later.
- ~~Retire Vercel references~~ **RESOLVED (2026-08-29): yes, clean them out.** Remove/reconcile Vercel assumptions in `docs/internal/fast.md` §8 and any stale CI/docs mentions; Vercel is obsolete per DEPLOYMENT.md (Oracle VPS). Performed during Phase 0 docs reconciliation, since this audit is planning-only.
- Coordinates completeness for future maps.

---

*This document is the authoritative mobile architecture. Any material change updates this file; `fast.md` remains the migration journal.*