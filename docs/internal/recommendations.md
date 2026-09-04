# Rumia — Multi-University Expansion Audit & Recommendations

Audit date: 2026-08-09. Scope: moving Rumia from a DeKUT-only product to a multi-university
platform (Region → Campus → Zone/Area → Hostel) across UI/UX, public pages, SEO, routing, and
engineering. Every claim below is backed by a `file:line` reference from the current codebase.

Legend: 🔴 must fix · 🟠 should fix · 🟡 nice to have · 🟢 already good (keep).

---

## A. Current Architecture

### A.1 Data model (Supabase)

- **`regions`** — the **47 Kenyan counties**, seeded idempotently, RLS is **read-only for every role**
  (`regions_block_writes`, `20260808000000_seed_counties_and_contact.sql`). A region is NOT free-form.
  `campuses.region_id` backfills from the campus `city` string.
- **`campuses`** — registry/SEO/hero data: `slug`, `name`, `city`, `region_id`, `status`
  (`active` | `coming_soon`), `hero_headline`, `hero_subtext`, `whatsapp_number`, `primary_color`,
  `feature_flags` (JSON: `landing_chips`, `landing_zones`, `landing_seo_description`), SEO/OG fields,
  `phone`, `email`, `social_links`.
- **`campus_zones`** — the "hostel area / zone" entity: `campus_id`, `name`, `slug`,
  `distance_category`, `full_search_price` (tour pricing), `UNIQUE(campus_id, slug)`.
  Public read; managers write their own campus/region; admin all.
- **`listings`** — `campus_id NOT NULL`, `county` + `area` (free-text strings), `slug`,
  price fields, amenities, geo, `distance_category`, `specific_location`, etc.
  RLS: public reads active; agent owns own rows; manager via `is_manager_of_campus`.
- **`agents`** — `campus_id NOT NULL`, `status`, `verified`, `is_featured`, `service_areas`, slug.
- **`profiles`** — role ∈ `student | agent | manager | admin` (unified, no `super_admin`).
  `campus_id NOT NULL`, `home_campus_id`, `home_campus_confirmed_at` (new signup flow).
  `managed_campus_id` XOR `managed_region_id` (CHECK constraint) for managers.
- **Supporting tables** — `listing_images`, `listing_room_types`, `leads`, `commissions`,
  `listing_views`, `agent_applications`, `tour_bookings`, `push_subscriptions`, `saved_hostels`,
  `feedback`, `transfer_history`, `listing_sort_history`, `listing_verifications`,
  `dekut_official_hostels`, `image_uploads`.

### A.2 Routing (App Router)

- `/` homepage — **`revalidate = 0`**, hardcodes `getCampusBySlug('dekut')`.
- `/hostels` — server-fetches **all** active listings, search/filter is 100% client-side.
- `/hostels/{county}/{area}` — campus landing; `county` = campus city lowercase, `area` = campus slug.
  `generateStaticParams` for active campuses; `revalidate = 3600`.
- `/hostels/{county}/{area}/{slug}` — hostel detail; `revalidate = 3600`; NO `generateStaticParams`.
- `/listing/{id}` + `/agent/{id}` — legacy UUID → 301 to slug canonical (middleware + SSR fallback).
- `/browse` — legacy, 301 → `/hostels`.
- `/agents` — redirects to `/verify`. `/agents/{slug}` — agent profile.
- `/compare`, `/book-tour`, `/verify`, `/verify/records`, `/verify/report`, `/account/*`, `/offline`,
  `/policy`, `/terms`.
- Admin: `/admin/*` (campuses, regions, managers, agents, listings, leads, tours, commissions,
  transfers, feedback, users, settings, official-hostels, analytics).
- Manager: `/manager/*` (dashboard, zones, settings, agents, applications, listings, staff).
- Agent dashboard: `/dashboard/*` (new, edit, listings, leads, tours, analytics, earnings, payment,
  profile).

### A.3 Search pipeline

- `/hostels` loads every active listing with images + room types into the client, then
  `clientSearch` (Fuse.js over title/location/area/description) with structured filters
  (gender, amenities, room type, price, zones, distance) — `src/lib/search/*`.
- `parse-query.ts` maps natural language → filters, but its **`AREA_KEYWORDS` table is hardcoded
  to DeKUT zones** (Boma, Near Gate A/B, Nyeri View, Kahawa Ridge, Embassy, Nyaribo).

### A.4 Server actions / auth scoping

- `zones.ts` — manager-only zone CRUD with `checkManagerCampusScope` (campus + region aware).
- `listings.ts` — agent-only create/update; derives campus from `agents.campus_id`, normalizes
  `area` against `campus_zones`.
- `admin.ts`, `admin-campus.ts`, `campus-settings.ts`, `manager.ts` — admin/manager operations.
- Middleware: security headers + auth guard for `/dashboard`, `/admin`, `/manager`, `/account`;
  301s for legacy URLs. Skips Supabase session refresh on public routes (good).

### A.5 SEO surface

- `sitemap.ts` — static + active campuses + slugged listings + slugged agents.
- `robots.ts` — disallows `/admin`, `/dashboard`, `/api/`.
- `manifest.ts` — hardcodes `getCampusBySlug('dekut')`.
- Root layout default title: **"Find Student Hostels Near DeKUT Nyeri | Rumia"**.
- Per-page `generateMetadata` exists on campus landing, hostel detail, agent profile, verify.
- `opengraph-image.tsx` on hostel detail (dynamic, sharp-processed); `og-default.png` for landing.

---

## B. Current UI/UX (as built)

- **Public header** (fixed, transparent-on-home) with nav (Browse All / Verify / Saved / Login) +
  `CampusSwitcher` dropdown of all campuses (active → link, coming-soon → disabled "Notify" is
  toast-only, no persistence).
- **Homepage**: hero (hardcoded DeKUT image), search widget linking to `/hostels`, quick-location
  chips (from DeKUT listings only), `CampusPickerCards` (hardcoded preview copy/images for
  dekut/mmu/ku/uon/mmust/kisii), `PopularHostels` (campus-scoped RPC, always DeKUT on `/`),
  `EarlyAccessBanner`.
- **Campus landing**: hero SEO block + chips + `CampusCompareGrid` of up to 50 listings.
- **`/hostels` search**: desktop sidebar / mobile bottom sheet, active-filter chips, zone filter is
  hardcoded DeKUT zones, compare tray, skeleton loaders.
- **Hostel detail**: gallery, quick-facts, amenities, room types, "Included in Rent", map,
  nearby listings, agent card, WhatsApp contact modal, tour booking, save/share, view tracker,
  sticky mobile footer.
- **Manager UX**: zones CRUD (`ZonesClient`), campus settings (contact/SEO + zone editor),
  agents table, applications, listings edit, staff.
- **Admin UX**: campuses table + add sheet, read-only regions viewer (47 counties),
  managers assignment, official-hostels, analytics, etc.
- **PWA**: serwist SW, bottom nav, swipe navigation, install banner, offline page, push.

---

## C. Problems

### C.1 DeKUT hardcoding blocks multi-campus (the core problem)

- 🔴 `(public)/layout.tsx:13` — public chrome always loads campus `'dekut'`; footer WhatsApp number
  and the WhatsApp **message text "hostel near DeKUT"** (`public-footer.tsx:18`) are wrong for every
  other campus.
- 🔴 Homepage: `(public)/page.tsx:20,61` — metadata, hero, popular hostels, and quick-locations all
  hardcode DeKUT. `revalidate = 0` on `/` means no caching AND always-DeKUT.
- 🔴 Hostel detail: `[slug]/page.tsx:111,184,370,687` — title "Near DeKUT", JSON-LD address
  `Nyeri County`, share text "from DeKUT", nearby-card alt "near DeKUT Nyeri". A Nairobi hostel
  renders DeKUT copy.
- 🔴 Agent profile: `agents/[slug]/page.tsx:41-42,69-70,91` — metadata + hero hardcode DeKUT;
  loads `getCampusBySlug('dekut')` rather than the agent's own campus.
- 🔴 Search: `location-filter.tsx` — `ZONE_OPTIONS` is a hardcoded DeKUT zone list labeled
  "Location (DeKUT Zones)"; `/hostels` metadata says "Near DeKUT Nyeri" while showing all campuses.
- 🔴 `parse-query.ts` `AREA_KEYWORDS` — natural-language zone matching is DeKUT-only.
- 🔴 `new-listing-form.tsx:841` — new listings default `county: 'nyeri'` (only correct for DeKUT).
- 🟠 `dekut-areas.ts` (`DEKUT_AREAS`, `AREA_OPTIONS`, `AREA_PRICES`, `AREA_PROXIMITY`,
  `DISTANCE_CATEGORY_OPTIONS`, `getDistanceBadgeText`) is consumed by `book-tour`, `compare`,
  `hostels-search`, `account-saved-tab`, `agent-profile-form`, `settings-client`,
  `new-listing-form` — a second, parallel zone taxonomy that duplicates `campus_zones` and
  contradicts the manager-configured zones.
- 🟠 `tour-pricing.ts` `PRICING_MATRIX` — full-search tour prices are hardcoded per DeKUT zone
  name; `api/tour-bookings` + `book-tour` use it instead of `campus_zones.full_search_price`.
- 🟠 `dekut-verification.ts` + `dekut-official-records.json` — the whole verification pipeline
  (`autoVerifyListing`, agent verification, `/verify`, `/verify/records`, `/verify/report`) is
  DeKUT-specific; every new listing/agent on any campus is auto-verified against DeKUT records.
- 🟠 Manifest, `terms`, `policy`, `verify/report`, `offline`, `account-overview-tab` — more
  hardcoded DeKUT copy.
- 🟠 `sitemap.ts:34`, `middleware.ts:64`, `listings.ts`, `manager.ts`, `admin.ts`, `browse`,
  `popular-hostels.tsx`, `campus-compare-grid.tsx`, `account` — all fall back to
  `county: 'nyeri'`, `area: 'dekut'` when building listing URLs.

### C.2 Hierarchy / taxonomy gaps

- 🟠 **No URL representation for Zone/Area.** URL shape is `/hostels/{city}/{campus}/{slug}`; the
  campus landing page exists, but there is **no zone landing page** (`/hostels/{county}/{area}/{zone}`)
  even though `campus_zones` is the source of truth. "Area" and "Zone" are the same thing
  (`campus_zones`), but the URL's third segment is the hostel slug, not the zone.
- 🟠 `listings.area` is a **free-text zone name** (normalized against `campus_zones` at write time
  via `normalizeCampusAreaSelection`), not a `zone_id` FK. Renaming/merging zones in
  `/manager/zones` leaves orphaned string values on existing listings.
- 🟠 `listings.county` is redundant with `campuses.city` and can drift (new-listing form defaults
  it to `'nyeri'` for every campus).
- 🟡 No `region` (county) landing page exists (e.g. "hostels in Nyeri"), even though regions are a
  first-class read-only table.

### C.3 Routing / canonical integrity

- 🔴 Hostel detail does **not validate** that `{county}/{area}` segments match the listing's
  campus (`[slug]/page.tsx:getListing` filters only by `slug` + `is_active`; `resolveCampusFromSegments`
  is imported but unused). A wrong-segment URL still renders → duplicate canonical URLs, wasted
  crawl budget, and split SEO signals.
- 🟠 Middleware/SSR 301s do a **network round-trip to Supabase REST** per legacy URL (acceptable but
  fragile; the fallback assumes nyeri/dekut).
- 🟠 `/listing/{id}` page exists only as an SSR redirect fallback (fine), but `(public)/listing/[id]`
  also holds the shared detail components — the shared components live under a redirect route, which
  is confusing for maintainers.
- 🟡 `/agents` redirects to `/verify` — there is no "agents directory" page even though agent
  landing content exists.

### C.4 Search / performance

- 🔴 `/hostels` ships the **entire active listings dataset** (with images + room types) to the
  browser and searches client-side. This does not scale to multiple universities (thousands of
  listings); first-load JS + Fuse indexing will degrade.
- 🟠 No server-side pagination or Supabase-side filtering on `/hostels`; every visit re-fetches all.
- 🟠 Homepage `revalidate = 0` (always dynamic) with 4+ DB queries per request; hostel detail has
  `revalidate = 3600` but no `generateStaticParams`, so it's never statically generated.
- 🟡 `fuzzy-search.ts` keeps a 5-minute module-level cache shared across all users (stale-by-design
  is fine, but it's a hidden global).

### C.5 Manager/admin flows

- 🟠 Manager zone **create is read-then-insert** (`uniqueZoneSlug` in `zones.ts`) — a race can
  violate `UNIQUE(campus_id, slug)`; no retry. Low risk, cheap to fix.
- 🟠 `ZonesClient` default zone form price `500` and `distance_category 'walking-500m'` are
  hardcoded defaults; tour pricing read from `PRICING_MATRIX` (constant) instead of the managed
  `full_search_price` — manager edits to zone tour prices have **no effect on checkout**.
- 🟡 Manager dashboard count queries are scoped correctly (`manager/page.tsx`), good.
- 🟢 Admin regions UI is a read-only county viewer — consistent with the read-only RLS.

### C.6 Minor / cosmetic

- 🟡 `CampusPickerCards` "Notify Me" is toast-only (no persistence/DB); `campus-switcher`
  "coming soon" items are inert.
- 🟡 `isFallbackCampus` sentinel `'dekut'` only kicks in when the DB has no campuses — mostly a
  build-time safety net; fine to keep.
- 🟢 RLS, roles, and manager scoping (`checkManagerCampusScope`, `is_manager_of_campus`) are well
  designed and multi-campus ready.

---

## D. Recommended UX flows

1. **Student browse flow (mobile-first):**
   Home → pick university (switcher / cards / search) → **campus landing** (zones listed) →
   tap zone → **zone landing** (listings in that area) → hostel detail → WhatsApp/Book tour.
   No "region" terminology exposed to students — call zones "areas"/"hostel areas".

2. **Student signup/onboarding:** pick home campus once (already in progress via
   `home_campus_confirmed_at`) → that campus becomes the default context in the header and
   `/hostels` filter, persisted in a cookie/localStorage, overridable via `CampusSwitcher`.

3. **Agent flow:** agent is bound to a campus (`agents.campus_id`, NOT NULL). New listing form:
   area selector already comes from `campus_zones` — keep, but make `county`/URL derive from the
   campus, never a hardcoded `'nyeri'`.

4. **Manager flow:** `/manager/zones` → create/edit/delete zones for the campus they manage
   (campus- or region-scoped) → zone tour price edits must flow to tour booking checkout.
   Managers see exactly their campus/region data everywhere.

5. **Admin flow:** create campus → set region (county) → assign campus manager → manager seeds
   zones → campus goes live; zones and campus settings drive all public copy (no code changes).

---

## E. Recommended public page IA

| URL | Purpose | Status |
|---|---|---|
| `/` | Brand + all-universities hub | keep, de-hardcode |
| `/hostels` | All-campus search + filters | keep, de-hardcode metadata, server-side search |
| `/hostels/{city}/{campus}` | Campus landing (SEO page) | keep as-is |
| `/hostels/{city}/{campus}/{zoneSlug}` | **Zone landing (NEW)** — SEO page per zone with its listings | add |
| `/hostels/{city}/{campus}/{zoneSlug}/{slug}` | Hostel detail (URL gains zone segment) | add, with 301s |
| `/agents/{slug}` | Agent profile | keep, de-hardcode |
| `/verify`, `/verify/records` | Hakikisha (DeKUT-specific brand) | keep |
| `/compare`, `/book-tour` | Utilities | keep |
| `/hostels/{county}` (region landing) | Optional county index | optional |

---

## F. SEO recommendations

### F.1 Root + shared defaults (what/why/files)
- **What exists:** root layout default title "Find Student Hostels Near DeKUT Nyeri | Rumia",
  DeKUT keywords, `manifest.ts` hardcodes dekut.
- **What's wrong:** every unset page inherits DeKUT; the product is multi-university now.
- **What should change:** generic brand default ("Rumia — Verified Student Hostels in Kenya");
  `%s | Rumia` template stays. Campus-specific copy lives on campus landing/hostel detail metadata.
- **Why:** crawlable pages must not mislabel other campuses as DeKUT.
- **Files:** `src/app/layout.tsx`, `src/app/manifest.ts`.

### F.2 Per-campus metadata driven by `campuses`, not constants (what/why/files)
- **What exists:** campus landing reads campus SEO fields (`[area]/page.tsx`); hostel detail and
  agent pages hardcode DeKUT strings.
- **What should change:** hostel detail + agent profile resolve the campus from `listing.campus_id`
  / `agent.campus_id` (via `campuses`) and use campus SEO copy + city/county in title, description,
  JSON-LD, alt text, and breadcrumbs.
- **Files:** `[slug]/page.tsx`, `agents/[slug]/page.tsx`, `popular-hostels.tsx`,
  `campus-compare-grid.tsx`, `account-overview-tab.tsx`, `offline`, `terms`, `policy`.

### F.3 Canonical integrity (what/why/files)
- **What exists:** legacy UUID → slug 301s; detail page trusts URL segments.
- **What should change:** hostel detail should **validate `{county}/{area}` against the listing's
  campus** and 301/404 on mismatch; add `canonical` derived from the listing's stored county/area,
  not the request segments.
- **Why:** prevents duplicate canonical URLs and split link equity as URLs gain zone segments.
- **Files:** `[slug]/page.tsx`, `middleware.ts`, `sitemap.ts`.

### F.4 Sitemap (what/why/files)
- **What exists:** static + campuses + slugged listings + agents.
- **What should change:** derive county/area from campus/zone rather than `|| 'nyeri'` fallbacks;
  add zone landing URLs once they exist; keep `lastmod` from `updated_at`.
- **Files:** `src/app/sitemap.ts`.

### F.5 No thin pages
- Zone landings must have unique copy (zone name + campus + a real grid of listings), not template
  shells. Region landings optional and must also be substantive. Do not generate empty pages.

---

## G. Routing recommendations

1. 🔴 **Validate detail segments** — hostel detail resolves campus from segments and compares to
   `listing.campus_id`; mismatch → 301 to canonical. (Files: `[slug]/page.tsx`.)
2. 🔴 **Derive county/area from campus everywhere** — replace `county || 'nyeri'` / `area || 'dekut'`
   fallbacks with values from the resolved campus/zones. (Files: `sitemap.ts`, `middleware.ts`,
   `listings.ts`, `manager.ts`, `admin.ts`, `popular-hostels.tsx`, `campus-compare-grid.tsx`,
   `browse/page.tsx`, `new-listing-form.tsx`.)
3. 🟠 **Add zone segment** — new route `/hostels/{county}/{area}/{zoneSlug}/{slug}` for hostel
   detail + `/hostels/{county}/{area}/{zoneSlug}` zone landing; 301 old 3-segment listing URLs to
   the 4-segment form (or keep 3-segment and add zone pages alongside — must be decided explicitly
   to preserve equity).
4. 🟠 **Campus context in `/hostels`** — read campus from URL/cookie to scope the filter UI and
   metadata instead of showing every campus with DeKUT zone chips.
5. 🟡 **Fix `/agents`** — either a real directory or keep redirect but update nav/links to be
   campus-aware.

---

## H. Engineering recommendations

1. 🔴 **Kill the parallel zone taxonomy** — route all zone data through `campus_zones`:
   - `location-filter.tsx` zone options ← `campus_zones` for the current campus.
   - `book-tour`/`api/tour-bookings` price ← `campus_zones.full_search_price` (+ `distance_category`).
   - `parse-query.ts` `AREA_KEYWORDS` ← campus zone names (or disable zone parsing outside a campus
     context).
   - Keep `getDistanceBadgeText`/`DISTANCE_CATEGORY_OPTIONS` as generic shared constants (they are
     campus-agnostic), but drop `DEKUT_AREAS`/`AREA_OPTIONS`/`AREA_PRICES` consumers.
2. 🔴 **Make verification campus-agnostic or gated** — `dekut-verification`/`autoVerifyListing`
   should only run for the DeKUT campus (or a per-campus official dataset); do not auto-mark other
   campuses' listings/agents against DeKUT records. (Files: `listings.ts`, `admin.ts`, `verify/*`.)
3. 🟠 **Store zone relation** — add `listings.zone_id UUID REFERENCES campus_zones(id)` and migrate
   `area` values; on zone rename, update children (or soft-cascade). Keeps taxonomy clean.
4. 🟠 **Server-side search** — move `/hostels` to Supabase filtering (county/area/price/gender/
   amenities via Postgres, already has `fts` GIN index `listings_fts_idx`) with server pagination or
   infinite scroll; keep client fuzzy as a progressive enhancement only when dataset is small.
5. 🟠 **Caching** — set `revalidate > 0` on `/` (ISR) and add `generateStaticParams` for active
   listings on the detail route; keep `revalidate=3600`.
6. 🟠 **Zone slug race** — after `uniqueZoneSlug`, retry insert once on unique violation.
7. 🟠 **Manager tour-price wiring** — `updateZoneAction` already persists `full_search_price`;
   make booking read it (H.1) and surface the price in `ZonesClient` so managers see live effect.
8. 🟡 **Move shared detail components** out of `(public)/listing/[id]` into `src/components/hostels/`
   so the redirect route and the shared UI aren't entangled.
9. 🟡 **`CampusPickerCards`/switcher "Notify Me"** — persist intent (e.g., `campus_waitlist`
   table) or remove the fake toast.

---

## I. Phased plan

### Phase 1 — Critical UX & architecture (do first; unblocks everything)
- [ ] De-hardcode public chrome: header/footer/root metadata/manifest resolve real campus
  (`(public)/layout.tsx`, `layout.tsx`, `manifest.ts`, `public-footer.tsx`).
- [ ] Hostel detail + agent profile resolve campus from `campus_id`; fix metadata/JSON-LD/alt copy
  (`[slug]/page.tsx`, `agents/[slug]/page.tsx`).
- [ ] New-listing form derives `county` from the agent's campus (`new-listing-form.tsx:841`).
- [ ] Replace DeKUT zone list in `location-filter.tsx` + `parse-query.ts` with campus-driven zones.
- [ ] Derive county/area from campus in all URL builders (`sitemap.ts`, `middleware.ts`, actions,
  components).
- [ ] Detail-page segment validation → 301/404 on mismatch.
- [ ] Gate DeKUT verification to DeKUT campus.
- [ ] ISR on `/` + `generateStaticParams` on hostel detail.

### Phase 2 — Public discovery & search
- [ ] Zone landing pages (`/hostels/{county}/{area}/{zoneSlug}`) with real content + JSON-LD.
- [ ] Decide + implement listing URL shape (3- vs 4-segment) with 301s.
- [ ] Campus-scoped `/hostels` (URL/cookie context) with server-side filtering + pagination.
- [ ] Campus context persistence for students (cookie/localStorage) integrated with switcher.
- [ ] `/agents` directory or clearer nav; campus-aware agent profiles.

### Phase 3 — SEO
- [ ] Breadcrumbs JSON-LD on detail/landing/agent pages.
- [ ] Per-campus OG images (dynamic OG route currently hardcodes dekut).
- [ ] Sitemap: campus-derived URLs + zone pages; verify no `nyeri`/`dekut` fallbacks.
- [ ] Crawl-test wrong-segment URLs, verify 301s, monitor duplicate canonicals in Search Console.
- [ ] Consider county (region) landing pages if substantive content is feasible.

### Phase 4 — Polish & performance
- [ ] Remove dead/parallel constants (`DEKUT_AREAS` consumers, `AREA_OPTIONS` in book-tour,
  `PRICING_MATRIX`) and route everything through `campus_zones`.
- [ ] Add `listings.zone_id` FK + rename handling.
- [ ] Zone slug race retry; manager tour-price live preview.
- [ ] Move shared detail components out of the legacy redirect route.
- [ ] Load/size budgets on `/hostels`; lazy-load Fuse, code-split the search page.
- [ ] Final visual pass across all new pages on mobile.

---

## Verification notes (how to check work later)

- `pnpm typecheck` and `pnpm lint` (repo has `tsc --noEmit` and `eslint --max-warnings=0`).
- Crawl `/sitemap.xml` after Phase 3; assert zero URLs containing `nyeri`/`dekut` fallbacks for
  non-DeKUT listings.
- Spot-check a Nairobi-area listing detail page renders the campus's city/county, not "Nyeri/DeKUT".
