# 01 · Current-State Assessment and Technical Debt

Covers: current-state assessment, technical debt assessment.

Evidence tags used throughout this package:

- **[FACT]** read in code, config or the existing production audit (`docs/PRODUCTION_READINESS_AUDIT.md`, which contains production evidence gathered 2026-10-05).
- **[OBS]** an interpretation of facts.
- **[ASSUMPTION]** something I could not verify and am treating as true for planning. These are collected in `README.md` → Open questions.
- **[REC]** a recommendation.

What I could not do: read production data in this session (access was declined), so supply-side numbers (active listings, agents with live listings, leads per month, video coverage) are unknown. Section 9 of the README lists the one query that would settle them.

---

## 1. What Rumia actually is today

**[FACT]** A student-hostel discovery product for DeKUT (Nyeri) that has had apartments, short stays ("RumiaBnB"), multi-campus support, paid tours, a "find me a hostel" concierge, reviews, a verification checker ("Hakikisha"), agent commissions and a native mobile app added around it.

| Surface | Size | Notes |
|---|---|---|
| Public web pages | ~18 routes | `/`, `/hostels/...`, `/bnb/...`, `/videos`, `/compare`, `/verify/...`, `/agents/...`, `/book-tour` |
| Seeker account | `/account` (tabs), `/saved` | Profile completion modal, saved, tours, "find me a hostel", agent application |
| Agent dashboard | 13 pages under `/dashboard` | Hostel form (1,814 lines), separate BnB form (789 lines), leads, tours, earnings, payment, analytics |
| Manager console | 11 pages under `/manager` | Campus settings/branding, zones, agents, applications, listings, requests, announcements, staff, payments |
| Admin console | 22 pages under `/admin` | Users, agents, listings, leads, commissions, transfers, tours, campuses, regions, official hostels, legal, feedback, analytics, settings |
| Backend | FastAPI, 25 feature slices, ~15k lines | `backend/app/features/*` |
| Mobile | Expo app at `nginx/mobile/` | Parallel client of the same API |
| Data | Postgres 17, self-hosted on one Oracle VM since 2026-10-01 | 87 SQL migrations in `supabase/migrations/`, known drift vs live |

**[OBS]** Forty-six internal pages exist for an operation that, per production evidence, has 2 admins and 6 managers, and signs up 1 to 4 new users a day. The internal tooling is larger than the public product. That ratio is the clearest single signal that the product has grown by accretion: each new idea got its own surface.

---

## 2. Architecture as built

```
Browser / PWA ──► Cloudflare ──► nginx (VM) ──► Next.js 16 (SSR/ISR, BFF routes, image processing with sharp)
                                       │                 │
                                       │                 └──► FastAPI via the PUBLIC URL (through nginx again)
                                       └──► FastAPI (gunicorn, 4 workers, in-process cron in each)
                                                     │
                                                     ├──► Postgres 17 (same VM)
                                                     ├──► R2 (images), Brevo (email), Web Push / Expo push
                                                     └──► PostHog, Sentry
Expo app ─────────────────────────────────────────────► FastAPI
```

**[FACT]** Not as described in the brief: hosting is an Oracle VPS with nginx and docker compose, not Vercel. There is no Redis. TanStack Query is installed but has zero call sites. Axios and fetch are both used.

### What is genuinely good (keep)

| Area | Why it is worth keeping | Evidence |
|---|---|---|
| FastAPI modular monolith with feature slices | Boundaries mostly respected, business rules in services | `backend/app/features/*` |
| Own auth: rotating refresh tokens, family revocation, reuse detection, signed OAuth state, nonce | Better than most products this size | `features/auth/service.py`, `core/tokens.py` |
| Commit-before-response DB session pattern | Correct and tested | `core/database.py`, `tests/test_db_session_scope.py` |
| Postgres as the single store | Correct for the next several years of scale | Audit §4 |
| R2 image pipeline with variants and blur placeholders | Right approach; only the place it runs is wrong | `web/src/lib/image/*` |
| Backups: nightly local + offsite to R2, restore-tested | Rare at this stage | `docs/DB_MIGRATION.md` |
| CI guards: OpenAPI snapshot, generated mobile types, "no direct DB from web" ratchet | Prevent regression of the decoupling work | `.github/workflows/ci.yml` |
| Error envelope `{error:{code,message,details}}` with machine-readable 409 codes | Good contract shape; needs consistent use | `core/errors.py` |
| DeKUT official-records verification | A real trust wedge competitors don't have | `features/listings/verification.py` |

---

## 3. Critical journeys traced through the code

### 3.1 Signup and login

**[FACT]** Google OAuth only. Login = signup. Full trace in the audit §3. Root cause of failures was proven in production: sign-ins started on `www` failed 100% of the time (host-only state cookie) and the v5 service worker fired duplicate starts. Both fixed on 2026-10-05 (`1e862c1`).

**[FACT]** 44% of 918 student profiles are incomplete (no phone or no confirmed campus). The completion modal asks for a phone and a home campus right after first sign-in.

**[OBS]** Two structural problems remain even after the fixes:

1. **Google OAuth is refused inside WhatsApp, Instagram and Facebook in-app browsers** (`disallowed_useragent`). Rumia's distribution is WhatsApp links. There is no detection or "open in browser" guidance (`auth/login/page.tsx`).
2. **The product asks for identity before it delivers value.** The campus question is meaningless for a non-student, and the phone is asked for at a moment unrelated to any action the user wanted.

### 3.2 Contacting a property (the core conversion)

**[FACT]** `web/src/app/(public)/listing/[id]/contact-modal.tsx`:

1. User taps Contact and must choose between "hostel owner" and "Rumia agent" (two concepts a visitor does not understand).
2. If not signed in → Google OAuth redirect (lines ~321–340). Context is stashed in `sessionStorage` and resumed after return.
3. If no valid phone on the profile → phone step.
4. If "Rumia agent" on a listing that does not pay commission → consultation-fee disclosure step.
5. If the hostel is full → a different notice offering a paid agent.
6. `POST /leads/track` → WhatsApp opens.

**[OBS]** This is the single most important finding in this package. The action that creates value for every party (seeker, owner, Rumia) sits behind a Google sign-in that **does not work in the browser most visitors arrive in**, followed by up to three more steps and a fee. Every other UX improvement is secondary to this.

### 3.3 Listing creation, editing, publication

**[FACT]**

- One 1,814-line form for hostels/apartments (`dashboard/new/new-listing-form.tsx`) and a separate 789-line form for short stays. Fields are hostel-shaped: gender, bathroom type, distance from campus, M-Pesa details, commission toggle.
- No listing lifecycle. A listing is `is_active` true/false. There is no draft/review/published/stale/archived state, so there is no review queue and no freshness model. `is_full` is a manual boolean.
- `resolve_agent_for_user` (`listings/service.py:188`): an admin without an agent row has listings **attributed to an arbitrary agent** (`select(Agent).limit(1)`); a manager without one gets an agent created with the placeholder phone `+254700000000`, which then becomes the public contact number. **Bug.**
- Auto-verification against DeKUT records runs inside `create_listing` and swallows all exceptions (`except Exception: pass`).
- Images are uploaded through a Next.js API route that processes them with `sharp` in the web process (`app/api/images/process/route.ts`), authenticating via a file still named `lib/supabase/server`.
- Video is a single `youtube_id` per listing.

### 3.4 Discovery and search

**[FACT]**

- Home page server-renders by calling the feed endpoint **five times** (all, apartments, short stays, popular, newest) and deduplicating in the page (`(public)/page.tsx`). Everything defaults to campus `dekut`.
- `/hostels` fetches **up to 1,000 listings with images and room types in one response** and searches client-side with Fuse.js (`hostels/page.tsx:35`, `lib/search/client-search.ts`). The API allows `limit` up to 1,000 (`core/pagination.py:12`).
- Backend search is `ILIKE '%q%'` over four columns with a 30-second per-process cache of ORM objects (`search/service.py`), which is inconsistent across 4 workers and holds detached ORM instances.
- "Popular" = all-time view count, unioned across raw views and daily rollups on every request.
- Ranking otherwise = admin-curated `sort_position` plus a "shuffle" function.

**[OBS]** Fine at a few hundred listings. It does not survive multiple towns, and shipping 1,000 listings to a phone on metered data is a cost the user pays.

### 3.5 Property detail

**[FACT]** `hostels/[county]/[area]/[slug]/page.tsx` (778 lines): gallery, quick facts, utilities, amenities, room types, location, reviews, view counts, lazy YouTube, contact and book-tour buttons. URL bakes in the word "hostels" for every category; short stays live under `/bnb/[id]` instead.

### 3.6 Agent, manager, admin workflows

**[FACT]**

- **Agent**: apply (with ID number, hostel name, relationship to hostel) → manager approves → role becomes `agent` → can create listings in their campus only. Earns "commission" (below). Sees leads, tours, analytics, earnings.
- **Manager**: scoped to one campus or one region. Edits campus **branding** (hero, colour, WhatsApp, fees), zones and tour prices, approves agents, suspends agents, edits in-scope listings, sets owner phones, handles "find me a hostel" requests, posts announcements.
- **Admin**: everything, plus user roles, staff, commissions, transfers between agents, ordering/shuffle, verification runs, legal documents.

### 3.7 Money

**[FACT]** `leads/service.py:43-157`. Every contact click on a commission-paying listing, deduplicated per IP hash per 24 h, **creates a pending commission of 10% of the monthly price (minimum KSh 1,000)** and increments the agent's balance. The IP hash comes from a header that can be spoofed (audit item 6). Separately: consultation fees, hostel-finding fees, and tour fees are collected manually and paid directly to agents (no payment integration exists).

**[OBS]** A click is not a tenancy. Recording money owed on a click means the commission ledger cannot be trusted, and the incentive points agents at generating clicks rather than placing tenants. Four fee types (commission, consultation, finding, tour) is also a lot for a visitor to understand. This is a business-model decision I cannot make for you; see `04-operating-model.md` §6 and the open questions.

---

## 4. Technical debt register

Severity: **S1** blocks the restructure or causes user harm now · **S2** will block growth · **S3** cleanup.

| # | Debt | Sev | Evidence | Disposition |
|---|---|---|---|---|
| D1 | Contact gated behind Google sign-in that fails in in-app browsers | S1 | `contact-modal.tsx` | Replace (see 05, 06) |
| D2 | Commission accrued per click, on a spoofable IP dedupe | S1 | `leads/service.py`, `core/ratelimit.py` | Replace with outcome-based ledger |
| D3 | Admin listings attributed to an arbitrary agent; placeholder phone becomes public contact | S1 | `listings/service.py:194-212` | Fix in Phase 0 |
| D4 | Admin-by-email trigger still recreated by migration replay | S1 | `supabase/migrations/20260611070823_*` | Drop in baseline |
| D5 | Client IP trust: rate limits share one bucket server-side and are spoofable client-side | S1 | Audit items 2, 6 | Fix in Phase 0 |
| D6 | No listing lifecycle or freshness model | S2 | `listings/models.py` | Rebuild (07) |
| D7 | Flat hostel-shaped `listings` table, free-text `property_type`, no property/unit split | S2 | `listings/models.py` | Rebuild additively (07) |
| D8 | DeKUT/Nyeri hard-wired in 73 web files and 14 backend files; campus required on profile, listing, agent | S2 | grep; `profiles.campus_id NOT NULL` live | Replace with markets/places (07) |
| D9 | Short stays are a parallel API, form, search and URL scheme | S2 | `features/bnb`, `/bnb` routes | Fold into one catalog |
| D10 | Migrations: SQL files from the Supabase era, no runner in deploy, live drift | S2 | `docs/DB_MIGRATION.md` | Alembic baseline from live |
| D11 | Cron and retries run in each of 4 gunicorn workers; no row claiming | S2 | `core/tasks/cron.py`, `Dockerfile -w 4` | One worker process, `SKIP LOCKED` |
| D12 | CD not gated on CI, no rollback, no migration step | S2 | `cd.yml`, `scripts/deploy.sh` | Fix in Phase 0 |
| D13 | Backend image ignores `uv.lock` (`COPY pyproject.toml README.md` only, then `uv sync --frozen \|\| uv sync`) | S2 | `backend/Dockerfile` | Copy lockfile, drop fallback |
| D14 | Tests never touch SQL (all mocked) | S2 | `backend/tests/conftest.py` | Real Postgres in CI |
| D15 | Three overlapping internal consoles, 46 pages | S2 | `app/(admin)`, `(manager)`, `(dashboard)` | Replace with two surfaces (04) |
| D16 | Two ORM classes mapped to `agents` (`Agent`, `AgentProfile`) with different columns | S2 | `listings/models.py`, `agents/models.py` | Merge |
| D17 | Analytics: ~11 ad-hoc PostHog events; no search, impression, share, video or save-context events | S2 | grep `posthog.capture` | Event model (08) |
| D18 | Video is a YouTube id: no watch data, YouTube branding and exits, no control of quality on mobile data | S2 | `listings.youtube_id` | Native video (09) |
| D19 | Feed endpoint allows `limit=1000`; `/hostels` uses it | S2 | `core/pagination.py`, `hostels/page.tsx` | Cap at 50; server search |
| D20 | Image processing in the Next process | S3 | `app/api/images/process/route.ts` | Direct upload + worker |
| D21 | Supabase leftovers: JWKS path, shim schema, `@supabase/*` packages, files named `supabase` | S3 | `core/security.py`, `web/src/lib/supabase/*` | Remove |
| D22 | Role resolution fails open; suspended users keep access | S2 | `core/security.py` | Fail closed; check status |
| D23 | Access token cookie readable by JS; CSP allows unsafe-inline/eval | S3 | Audit §14 | Harden in Phase 2 |
| D24 | Frontend: 0 TanStack Query uses, ~70 files fetching in `useEffect`; 3 icon libraries, 2 chart libraries, three.js, Cypress and Playwright both, axios and fetch | S3 | `web/package.json` | Consolidate during rebuild |
| D25 | Very large components (1,000–1,800 lines) | S3 | `wc -l` | Dissolve during rebuild |
| D26 | Circular import `tours/service.py` ↔ `zones/router.py` | S3 | Audit item 12 | Fix |
| D27 | Mobile app lives under `nginx/mobile/` | S3 | Repo layout | Move to `apps/mobile` or freeze (06) |
| D28 | Private SSH key and its passphrase file sit in the repo root (gitignored, not tracked) | S2 | `ls -la` | Move out of the working tree; rotate if ever shared |
| D29 | Per-process search cache returning ORM objects | S3 | `search/service.py` | Remove |
| D30 | Bulk unpaginated public endpoint exposing phones and M-Pesa details | S2 | `public/router.py` `verify-candidates` | Per-item lookup |

---

## 5. Summary judgment

**[OBS]**

- **The engineering foundation is better than the product built on it.** Auth, data access, backups and CI guards are sound. Nothing here justifies a rewrite of the backend or a change of stack.
- **The domain model is the real constraint.** A flat, hostel-shaped listing with no lifecycle, a campus required everywhere, and short stays bolted on beside it. Every vision item (multi-category, multi-town, freshness, trust, personalization) runs into this.
- **The product's front door and core action are fragile in exactly the channel Rumia grows through** (WhatsApp links → in-app browser → Google sign-in wall).
- **The operating model is encoded as three consoles and a per-click commission**, neither of which matches what the business needs to do at scale: keep listings true.
