# 10 · Testing Strategy and Migration Strategy

Covers: testing strategy, migration strategy (data, code, URLs, users).

---

## 1. Testing strategy

### 1.1 Current state

**[FACT]**

- Backend: ~255 pytest tests, all with mocked database results (`tests/conftest.py`). They pass in 8 s without a database.
- Web: 19 Jest test files; Cypress and Playwright both installed; no E2E in CI.
- CI: OpenAPI snapshot check, generated mobile types check, no-direct-DB guard, `tsc`, build, docker build.

**[OBS]** The tests protect against Python-level regressions but not against the class of bugs the audit and production actually found: SQL behaviour, schema drift, triggers, cookie/host interactions, in-app browsers, service-worker behaviour.

### 1.2 Target pyramid

| Layer | What | Tooling | Runs |
|---|---|---|---|
| **Unit** | Pure rules: ranking score, intent parsing, lifecycle transitions, permission matrix, price/tier derivation, phone normalisation | pytest, Jest/Vitest | Every push, < 30 s |
| **Integration (real DB)** | Services against Postgres built from Alembic migrations: catalog CRUD + lifecycle, search with PostGIS/trigram, inquiries + ref codes, jobs claiming with `SKIP LOCKED`, permissions with scoped data | pytest + Postgres service container (or testcontainers), transactional fixtures, factory data | Every push |
| **Migration tests** | Upgrade from baseline to head on an anonymised production snapshot; downgrade where defined; backfill scripts idempotent and counted | Alembic + snapshot in CI artifact store | On migration changes and nightly |
| **Contract** | OpenAPI snapshot (keep); generated web and mobile clients compile; breaking-change detector (`oasdiff`) against the frozen mobile client | Existing + oasdiff | Every push |
| **E2E** | The critical journeys below on a mobile viewport, against a docker-compose stack with seeded data | Playwright (remove Cypress) | Every PR to main; nightly against staging |
| **Performance** | Search, feed and property endpoints on 50k seeded properties; p95 budgets; web Lighthouse CI budgets on property page | k6 or Locust; Lighthouse CI | Nightly and before launches |
| **Manual device checks** | Real Android phone: WhatsApp in-app browser open of a property link, contact, share; low-end device performance | Checklist in release notes | Before each release touching public pages |

### 1.3 Critical journeys (E2E)

1. Open a property link with a WhatsApp in-app browser user agent → page renders → contact opens a WhatsApp URL with a ref code, no sign-in.
2. Search with natural language → chips → results → open → save (anonymous) → sign in → save persists.
3. Create a saved search → a matching new listing goes live → alert job produces a delivery.
4. Lister: sign in → create listing (media upload, units) → submit → reviewer approves → live → page renders.
5. Freshness: listing passes interval → reconfirmation sent → "still available" link → `last_confirmed_at` updated; no answer → stale → paused.
6. Report "scam" twice → listing held → reviewer removes → audit log entry.
7. Sign-in on `www` and apex, with and without service worker installed.

### 1.4 Test data

- Factories for every core entity; a seed command that builds a realistic Nyeri market (places, landmarks, 500 properties, varied media and states) used by dev, E2E and staging.
- Anonymised production snapshot for migration tests: phones, emails, names replaced; coordinates jittered.

---

## 2. Migration strategy

### 2.1 Approach: strangler, not rewrite

- The backend and web stay on their stacks. New modules and tables are added beside old ones.
- Each **surface** switches to the new model in one release: property page → search → home → saved → lister workspace → ops console. Old surfaces are deleted when the new one ships, not kept "for a while".
- Old API endpoints used by the frozen mobile app are served by adapters over the new tables until the mobile app is updated or retired.

### 2.2 Data migration steps

1. **Baseline** (Phase 0): Alembic baseline from live production schema. Reconcile drift (`agent_messages`, `agents.suspension_reason`, `listings.zone_id`, `listing_verifications`, `profiles.campus_id NOT NULL`). Remove the admin-by-email trigger from any replay path. Delete the SQL replay as a build source.
2. **Geography** (Phase 1): create `markets`, `places`, `landmarks`; seed Nyeri; map `campus_zones` → neighbourhoods; DeKUT → landmark; counties from `regions`. Geocode existing listings without coordinates (ops task from a queue; zone centroid as fallback).
3. **Identity** (Phase 1): `users` from `auth.users` + `profiles` (same ids); `staff_assignments` from `role` + `managed_*`; `auth_identities` for Google. `profiles` kept as a compatibility view until all reads move.
4. **Catalog** (Phase 1): orgs from agents; properties + units from listings, room types and bnb details (`07` §5); media from images and YouTube ids; verification evidence from verified flags and registry matches. Backfill script is idempotent, keyed by old id (`legacy_listing_id` column), prints counts and diffs.
5. **Dual-write window** (Phase 1–2, short): writes from the old dashboard go through the new services (old endpoints become adapters), so there is one write path even while two UIs exist. Avoids two-way sync.
6. **Engagement** (Phase 2): wishlists → saves; leads → historical inquiries; commissions → legacy ledger entries; views → events.
7. **Contract** (Phase 3): drop old tables after a final export to R2; remove adapters when no traffic hits them for 30 days.

### 2.3 URL migration

- Generate a redirect map: every `/hostels/{county}/{area}/{slug}`, `/bnb/{id}`, `/listing/{id}`, `/agent/{id}`, `/agents/{slug}` → new canonical URL. Serve as 301 from the Next proxy (lookup table cached) so shared links in WhatsApp history keep working indefinitely.
- Update sitemaps, canonical tags and Search Console. Expect a temporary ranking dip; place/landmark pages should recover and exceed it.

### 2.4 User migration

- Seekers: nothing to do. Existing accounts keep working; saved items carry over. Profile completion modal removed.
- Agents → lister org owners/agents automatically. One message per agent explaining the new workspace, reconfirmation, and what changed about commissions (if the revenue model changes). Give a date.
- Managers → market leads or reviewers. A short walkthrough of queues.
- The 407 incomplete profiles: no action; they no longer block anything.

### 2.5 Rollback

- Every phase is behind feature flags per surface (a simple `feature_flags` table or PostHog flags), so a surface can revert to the old one while data stays in the new tables.
- Backfills are re-runnable; old tables are untouched until contract.
- Database restore tested before each contract step.
