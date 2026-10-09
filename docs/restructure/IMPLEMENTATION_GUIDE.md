# Implementation Guide for AI Agents

You are implementing the Rumia restructuring plan in this repository. This file tells you what to read, what order to work in, how to work safely, and when to stop and ask. Read it fully before touching code.

---

## 1. Ground rules (non-negotiable)

1. **Never push to `main`.** Pushing to `main` deploys to production automatically (`.github/workflows/cd.yml`). Work on a branch and open a pull request. The human merges.
2. **Never touch production.** No SSH to servers, no production database queries, no reading or editing `backend/.env`, `web/.env.*`, `.env*`, `*.key`, `.ssh-key-passphrase.txt` or anything in `certbot/`. If you need a production fact, ask the human to run a read-only command and paste the output.
3. **No rewrite of the stack.** Keep Next.js, FastAPI, SQLAlchemy async, Postgres, Tailwind, shadcn/ui. Do not add microservices, Redis, Kafka, Elasticsearch, Kubernetes, GraphQL or an ML system. The reasons are in `11-roadmap-and-risks.md` §3.
4. **Additive data changes only** until the contract phase. New tables beside old ones, idempotent backfills, no dropping or renaming live columns. Every schema change must work with the previous code version running (expand → migrate → contract).
5. **Small, reviewable pull requests.** One coherent change per PR, ideally under ~600 changed lines excluding generated files. A PR description says what changed, why (link the plan section), how it was tested, and how to roll it back.
6. **Match the surrounding code.** Same naming, structure, comment density and idioms as the files you edit.
7. **Do not invent product decisions.** If the plan doesn't decide something, or an open question blocks it (§6), stop and ask instead of guessing.
8. **Report honestly.** If tests fail or you skipped something, say so in the PR and in your summary.

---

## 2. Read before coding

Read in this order. These are the specification; the current code is evidence, not the spec.

| Order | File | Why |
|---|---|---|
| 1 | `docs/restructure/12-recommendation.md` | The approved decisions in one place |
| 2 | `docs/restructure/ux/07-decisions-and-sequence.md` | UX decisions, Step 0 fixes, build order |
| 3 | `docs/restructure/11-roadmap-and-risks.md` | Phases, exit criteria, what not to build |
| 4 | `docs/restructure/01-current-state.md` | Technical debt register (D1–D30) referenced by tasks |
| 5 | `docs/PRODUCTION_READINESS_AUDIT.md` | Proven production defects and their fixes |
| As needed | `04-operating-model.md`, `06-architecture.md`, `07-domain-and-data.md`, `08-intelligence.md`, `10-quality-and-migration.md` | Detail for the area you're working on |
| As needed | `docs/restructure/ux/03`–`06` | Screen specs, design system, personalization rules |

When you start a task, re-read the specific section it cites.

---

## 3. Branching

- Create branches from an up-to-date `main`. Naming: `restructure/<milestone>-<short-topic>`, e.g. `restructure/m1-tablet-contact-fix`, `restructure/m2-alembic-baseline`.
- One branch per PR. If a milestone needs several PRs, make several branches.
- **First commit, if not already on `main`:** the planning docs in `docs/restructure/` are part of the spec. If `git status` shows them untracked, commit them on your first branch as `docs: restructuring plan and UX redesign` so reviewers and future agents have them.
- Commit messages: conventional style already used in this repo (`fix(web): …`, `feat(backend): …`, `docs: …`, `chore: …`).

---

## 4. How to verify every change

Run what applies before opening a PR. All must pass.

```bash
# Backend
cd backend && uv run pytest tests/ -q
cd backend && uv run python scripts/export_openapi.py && git diff --exit-code -- openapi.json   # if API changed, commit the new openapi.json

# Mobile contract (only if openapi.json changed)
cd nginx/mobile && pnpm run generate:api && pnpm exec tsc --noEmit

# Web
cd web && pnpm install --frozen-lockfile
cd web && pnpm typecheck && pnpm lint && pnpm test
cd web && pnpm build   # for route/layout changes

# Repo guards
scripts/check-no-direct-db.sh
scripts/pre-push-check.sh
```

Rules:

- Add or update tests for every behaviour you change. For backend logic that touches SQL, prefer a real-Postgres test once that harness exists (milestone 2); until then, note the gap in the PR.
- For UI changes, check the layout at 360, 768, 1023, 1024 and 1366 px wide. If browser tools are available, take screenshots and attach them to the PR description; if not, say so.
- Do not update snapshots or generated files to make a check pass without understanding why they changed.

---

## 5. Milestones and tasks

Work in this order. Don't start a milestone until the previous one is merged, unless the human says otherwise. Each task cites the plan section that specifies it.

### Milestone 1 · Live fixes on the current UI (start here)

Source: `ux/07-decisions-and-sequence.md` §3 Step 0, `ux/01-ux-audit.md` §2.1. Small, independent PRs.

| # | Task | Where to look |
|---|---|---|
| 1.1 | Contact button missing between 768 and 1023 px on property pages. Make the sticky bar and sidebar switch at the same breakpoint (1024 px) | `web/src/app/(public)/hostels/[county]/[area]/[slug]/page.tsx` (`hidden lg:block`, `md:hidden`), same in `web/src/app/(public)/bnb/[id]/page.tsx` |
| 1.2 | Remove the invented "Security Available" default; show security only when `security_type` is set | Same detail page sidebar |
| 1.3 | Remove the Unsplash fallback image; use a neutral "No photo yet" tile | `web/src/components/home/explore-listing-card.tsx` and any other `images.unsplash.com` fallback (`grep -rn unsplash web/src`) |
| 1.4 | Card price must equal the property page's "from" price (minimum available room-type price, else `price`). Put the rule in one shared helper used by both | Card components, detail page `startingPrice` |
| 1.5 | Hide public view counters; hide the reviews section when there are no reviews | `ListingViewCountsLine`, `ListingViewCountsAllTime`, `ReviewsSection` usage |
| 1.6 | Saving while signed out must return the user to the same page after sign-in | `web/src/components/ui/save-button.tsx` (`router.push('/auth/login')` without `next`) |
| 1.7 | Footer copy: remove "simplified lead generation"; neutral wording not limited to students | `web/src/components/layouts/public-footer.tsx` |
| 1.8 | Restore the location section (approximate area at minimum) | Commented-out `LocationSection` in the detail page |
| 1.9 | Lowercase, hyphenated area segments in property URLs, with 301 redirects from existing URLs (spaces, capitals). Update sitemap and canonical tags | URL builders (`grep -rn "/hostels/" web/src`), `web/src/proxy.ts`, `web/src/app/sitemap.ts` |
| 1.10 | Fix staff listing attribution: admin without an agent row must not get an arbitrary agent; never create agents with the placeholder phone `+254700000000`; return a clear error asking staff to set up their contact details instead | `backend/app/features/listings/service.py` `resolve_agent_for_user` |

Exit: all ten merged; nothing else changed in behaviour.

### Milestone 2 · Phase 0 stabilisation

Source: `11-roadmap-and-risks.md` §1 Phase 0; `01-current-state.md` D-items; audit §12.

| # | Task | Ref |
|---|---|---|
| 2.1 | Client IP trust chain: nginx sets the real client IP from Cloudflare's header (trusting only Cloudflare ranges); web forwards it on server-to-API calls; API rate limiter trusts only that header from known proxies | D5, audit items 2 and 6 |
| 2.2 | Move cron and delivery retries out of the gunicorn workers into one worker process (new compose service, same image); claim rows with `FOR UPDATE SKIP LOCKED` | D11 |
| 2.3 | Gate CD on CI (`workflow_run` or `needs`), tag images by commit SHA, keep the previous image for rollback, fail the deploy if the health check fails. **Show the human the workflow diff before merging; this changes how production deploys** | D12 |
| 2.4 | Backend Dockerfile copies `uv.lock` and uses `uv sync --frozen` with no fallback | D13 |
| 2.5 | Alembic setup with a baseline. **The baseline must come from the live schema**: ask the human to run `pg_dump --schema-only` on production and provide the file. Do not generate it from `supabase/migrations`. Make sure the admin-by-email trigger isn't in it | D4, D10, `07` §4.2 |
| 2.6 | Real-Postgres integration test harness in CI (service container, schema from Alembic) with first tests for sign-in upsert, listings feed and lead tracking | D14, `10` §1.2 |
| 2.7 | Report every auth-callback and contact failure branch to Sentry with a cause tag | audit item 3, `06` §5.2 |
| 2.8 | Fail closed on role lookup errors; enforce suspended status on requests and refresh; remove the Supabase JWKS verification path | D21, D22 |
| 2.9 | Detect in-app browsers on the sign-in page and offer "Open in browser" | `ux/04` §7 |
| 2.10 | Replace the bulk `/public/verify-candidates` endpoint with a rate-limited per-item lookup; update its web caller | D30 |

**Blocked until the human answers Q1** (revenue model): any change to commission accrual. Do not change `leads/service.py` commission logic without that decision.

### Milestone 3 · Foundations (Phase 1)

Source: `11` §1 Phase 1, `07-domain-and-data.md`, `10` §2. Each row is several PRs. Before starting, write a short design note for each (as a PR or in `docs/restructure/notes/`) and get it approved.

1. Event ingestion: `/events` endpoint, partitioned `events` table, PostHog forwarding, client batching. Instrument the current pages with the events in `08` §3.
2. **Contact without sign-in**: `inquiries` table with reference codes, WhatsApp pre-filled message, call link, "Did they reply?" prompt; remove sign-in, phone and fee steps from the current contact modal. Highest-impact item in the plan.
3. Anonymous device id; saves without an account, merged into the account on sign-in.
4. `markets`, `places`, `landmarks`; seed Nyeri; remove DeKUT/Nyeri defaults from code paths.
5. `users`, `auth_identities`, `staff_assignments`, `org_members`; permission-based authorisation (`04` §3.3).
6. `lister_orgs`, `properties`, `property_units`, media tables; idempotent backfill keyed by legacy id with count reports; old write endpoints become adapters.
7. Listing lifecycle and `last_confirmed_at`; the reconfirmation job. **Blocked until the human answers Q7** (messaging provider).
8. Direct-to-R2 uploads with worker image processing.

### Milestone 4 · New public experience

Source: `ux/04-screen-specs.md`, `ux/05-design-system.md`, `ux/07` §3 Step 3. **Do not start until the human has approved designs** (made in Claude Design from `13-design-brief.md`). Build order:

1. Design tokens and core components.
2. Property page `/p/{slug}` + one-tap contact + OG image + redirects.
3. Explore (server-side search, filters, map split view, Show more) + place and landmark pages.
4. Device memory: recently viewed, Continue your search.
5. Saved + compare + alerts.
6. Sign-in sheet, Help & safety, `/check`, lister profile.
7. Delete the old public routes and components.

Milestones beyond this (lister workspace, ops console, ranking, native video) are in `11` §1. Ask before starting them.

---

## 6. Stop and ask the human when

- An open question in `docs/restructure/README.md` (Q1–Q8) blocks the task.
- You need production data, a schema dump, secrets or credentials.
- A change affects deployment, CI/CD, nginx, DNS or Cloudflare.
- A migration would lock or rewrite a large table, or can't run with the previous code version.
- The plan contradicts the code in a way that changes the task, or two plan documents contradict each other (`ux/` wins over `05-experience.md` for the public web).
- A test fails for reasons unrelated to your change.
- The task grows beyond one reviewable PR.

When you ask, say what you found, the options, and your recommendation.

---

## 7. Definition of done for a PR

- [x] Branch from current `main`, named `restructure/<milestone>-<topic>`
- [x] Change matches the cited plan section; any deviation explained
- [x] Tests added or updated; all checks in §4 pass locally
- [ ] `openapi.json` and mobile types regenerated if the API changed _(no API change on this branch's web-only tasks)_
- [ ] UI checked at the listed widths (screenshots if possible) _(no browser available — code-level review only; see `PROGRESS.md`)_
- [x] No secrets, env files or generated build output committed
- [ ] PR description: what, why (plan link), how tested, rollback, follow-ups
- [x] Not merged by you; not pushed to `main`

---

## 8. Progress log

Keep `docs/restructure/PROGRESS.md` up to date: one line per merged or open PR with milestone, task number, branch, status and any follow-up. Create it on your first branch. Future agents read it to know where things stand.
