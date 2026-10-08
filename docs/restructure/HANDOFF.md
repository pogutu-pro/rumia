# Handoff: where the restructuring stands

Branch: `restructure/m1-live-fixes` (26 commits ahead of `main`, nothing pushed, nothing deployed).
Read first: `IMPLEMENTATION_GUIDE.md` (rules), `12-recommendation.md` (decisions), `ux/` (screen specs). This file says what is done, what is not, and what was learned.

## Rules that still apply

- Never push to `main` (it deploys to production). Never touch production or env/key files. Open PRs; the human merges.
- Production safety classifier blocked edits to `.github/workflows/cd.yml` and `scripts/deploy.sh`. Do not retry; the change is a proposal in `proposals/2.3-gated-deploys-and-rollback.md` awaiting human approval.
- Alembic migrations `0002`–`0006` have only run on a scratch database. They must be rehearsed on a copy of production before deploy.

## Done (verified by tests)

Milestone 1 (live fixes): tablet Contact button, fake "Security Available" removed, stock-photo fallbacks removed, one shared "from" price, view counters and empty reviews hidden, save returns to page, neutral footer, location summary, clean lowercase URLs with permanent redirects, staff listing attribution fixed.

Milestone 2: client-IP trust chain (nginx + web + API), one worker container with SKIP LOCKED claiming, uv.lock-pinned image, Sentry on every sign-in failure branch with distinct user messages, in-app-browser notice on sign-in, fail-closed permissions + suspended agents blocked, bulk contact dump replaced by rate-limited `/public/verify-lookup`, real-Postgres test harness (`backend/tests_pg`, CI job added), admin-by-email trigger dropped by migration, schema drift reconciled, circular import fixed, Alembic scaffold with empty baseline `0001`.

Milestone 3 backend (Alembic 0002–0006): devices, partitioned events, inquiries with reference codes, device saves (merge on sign-in), markets/places/landmarks (Nyeri seeded, DeKUT a landmark), lister orgs, org members, staff assignments, properties + units + media + status history + evidence + reports + jobs, `project_listing()` SQL function keeping the new model in sync with legacy listing writes, lifecycle (transitions, signed one-tap links, freshness sweep), quality score/tier/walking distances, photo upload endpoints + Pillow worker, search with plain-language parser and ranking, similar places, saved-search alerts (email), ops queues/review/reports/visits/market health, lister workspace API, outcome-based ledger (fee off by default), cards-by-ids and lister profile endpoints. Config moves DeKUT/Nyeri defaults into settings.

Milestone 3 web: device id, event batching (`lib/events.ts`), generated typed client (`lib/api/rumia.ts` from `backend/openapi.json`; run `pnpm generate:api`), one-tap `ContactActions` + "Did they reply?" prompt, account-free saves (`stores/wishlist-store.ts`, `SaveButton`), contact modal deleted.

Milestone 4 so far: design tokens (`styles/rumia.css`, classes like `bg-rum-surface`), `PropertyCard`, `FactLine`, `MediaGallery`, `ShareButton`, `ReportButton`, `BackLink`, Explore home (`app/(public)/page.tsx` + `components/rumia/explore/*`), property page (`app/(public)/p/[slug]/page.tsx`). Rendered against a local API and checked as HTML only.

Test counts at handoff: backend 298 unit, 33 real-DB; web 224+ (run `pnpm test`).

## Remaining work (in this order)

1. **Replace the old chrome.** `app/layout.tsx` still mounts `BottomNav`, `CompareTray`, `MobileMain`, and `(public)/layout.tsx` uses the old `PublicHeader` (with the 947-line `NavbarSearch`) and `Footer`. Build the simple header from `ux/03-principles-and-ia.md` §3.1 (wordmark, search pill on non-Explore pages, Saved, Menu with Saved/Alerts/List your property/Help & safety/Sign in) and footer (Help & safety, List your property, About, Terms, Privacy). Remove the bottom nav on public pages.
2. **Saved screen** (`/saved`): ids from `GET /saves`, cards from `GET /discovery/cards?ids=`, status of let/paused places, compare tray of 2–3 using `GET /properties/{slug}`, alerts list/create/delete via `/discovery/alerts`. Current `/saved` and `account-saved-tab` still use the old wishlist.
3. **Sign-in sheet** opened in context and returning to the action; keep `InAppBrowserNotice`. Remove the profile-completion modal and the required campus (`app/account/profile-completion-modal.tsx`; backend `profiles.campus_id` is NOT NULL in production, so keep defaulting server-side).
4. **Pages:** Help & safety (`/help`, linked from every safety note), `/check` (use `/public/verify-lookup`), lister profile `/l/[slug]` (`GET /discovery/listers/{slug}`), place and landmark landing pages (`/{market}/{place}`, `/{market}/near/{landmark}`), `/c/[token]` one-tap confirm page (GET `/catalog/actions/{token}` previews, POST performs; never act on GET).
5. **Redirects and deletion:** 301 `/hostels/...`, `/bnb/...`, `/listing/[id]`, `/agent(s)/...`, `/compare`, `/videos`, `/browse` to the new URLs (property redirects can look up `slug` since `properties.slug == listings.slug`; BnB ids need a lookup by `legacy_listing_id`). Update `app/sitemap.ts` to `/p/{slug}` from the API. Then delete the old public pages/components once nothing imports them. The BnB reservation card currently builds its own WhatsApp link without a reference code; it disappears with the BnB pages.
6. **Explore map:** list + map split on desktop, full-screen map toggle on phones, loaded lazily and only when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set.
7. **Lister workspace** (`/workspace`): "Today" attention list from `GET /me/workspace`, org inquiries, mark let/pause/confirm (`/properties/{id}/confirm|let|pause`), team add. Listing create/edit still uses the legacy form and legacy endpoints, which keep the new model in sync via `project_listing()`; the step-by-step editor with direct R2 upload (`/media/uploads`, `/media/{id}/complete`) is still to be built.
8. **Ops console** (`/ops`): queues (`/ops/queues`), review (`/ops/review`, `/ops/properties/{id}/review`), reports (`/ops/reports`, resolve), stale orgs, site visits, market health. Then delete `(admin)`, `(manager)` and the old dashboard routes that are replaced.
9. **Finish:** `pnpm build` (never run since the new pages), accessibility pass (axe), responsive pass at 360/768/1023/1024/1366 px, update `README.md`/`.env.example`, add a `PROGRESS.md`, and tick the checklists in `IMPLEMENTATION_GUIDE.md` and `11-roadmap-and-risks.md` only for what is verified.

## Blocked on the human (do not guess)

- Q1 revenue model: do not change commission accrual. New contacts still accrue the legacy per-click commission behind `INQUIRY_ACCRUES_LEGACY_COMMISSION=true`; the move-in ledger fee `LEDGER_MOVE_IN_FEE_KES` is 0.
- Q7 messaging provider: reconfirmation reminders and alerts go by email only; WhatsApp/SMS is a documented plug-in point (`features/catalog/notify.py`, `features/discovery/alerts.py`).
- Alembic baseline from the live schema (needs a production `pg_dump --schema-only` from the human).
- CI-gated deploys with rollback (proposal 2.3).
- Design approval (the new screens follow `ux/04-screen-specs.md` but have not been through Claude Design or user testing).

## Things learned the hard way

- Mock-based tests miss real bugs. The real-DB suite caught: missing `listings.zone_id` in migrations, untyped NULL parameters (cast them), a trigger overwriting `updated_at` in tests, duplicated media rows on re-projection.
- `asyncpg` needs `CAST(:x AS uuid)` for uuid params and `CAST(:x AS text)` for nullable text in `IS NULL OR ...` checks.
- Run real-DB tests: start `postgres:17-alpine`, run `scripts/db-replay-migrations.sh` (DATABASE_URL in libpq form), then `cd backend && DATABASE_URL=postgresql+asyncpg://... uv run alembic stamp 0001 && uv run alembic upgrade head`, then `TEST_DATABASE_URL=postgresql+asyncpg://... uv run pytest tests_pg`.
- Smoke test: run `uvicorn app.main:app` with `RUN_SCHEDULER=false` and a test `DATABASE_URL`, and `next dev --webpack -p 3100` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`. First dev compile takes about a minute.
- Chain verification commands with `&&`, not `;`, or a failure can slip into a commit.
- The Claude-in-Chrome extension was not connected; nothing has been checked visually.
- The old test database seeds (`Baraka`, `Hidden flat`) came from the replayed migrations plus ad-hoc inserts; the real-DB tests create their own rows and roll back.
