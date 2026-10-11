# Rumia web: application audit (Phase 1)

Scope: `web/` (Next.js 16 App Router, React 19). Date: 2026-10-10. Read-only audit, no code changed.
Target look: `Rumia Rentals Dashboard and Video Tour.png` (repo root): left rail, header with one search + bell + avatar menu,
collection rows of property cards, right "Rumia Videos" portrait drawer.

Not verified in a browser: the local stack (`scripts/local-dev/up.sh`) was not running, so everything below comes from reading code.
Items marked (unverified) need a live check in a later phase.

## 1. Stack

| Concern | What exists |
|---|---|
| Framework / routing | Next.js 16 (webpack build), App Router, route groups `(public)`, `(videos)`, `(dashboard)`, `(admin)`, `(manager)`; `src/proxy.ts` (formerly middleware) refreshes sessions, redirects UUID URLs to slugs, guards `/account /dashboard /admin /manager`, sets CSP |
| Styling | Tailwind 4 (`@import 'tailwindcss'`) plus `tailwind.config.ts`; shadcn-style HSL CSS variables in `styles/themes.css`; hard-coded `slate-*` / `emerald-*` classes dominate in practice |
| Components | Radix primitives wrapped in `components/ui/*` (dialog, sheet, drawer, bottom-sheet, alert-dialog, confirmation-dialog, dropdown-menu, tabs, toast via `providers/toast-provider.tsx`, empty-state, error-state, skeleton) |
| Icons | `lucide-react` (primary), `@heroicons/react` (also installed) |
| State | Zustand: `wishlist-store`, `compare-store`, `filter-store`, `bnb-filter-store`; React Query installed; `context/NavigationContext.tsx` |
| API | `lib/api/*` (axios-based `client.ts`, `openapi-fetch` `rumia.ts` for the newer `/api/v1/*` endpoints), plus Next server actions in `app/actions/*` |
| Auth | Own FastAPI auth. `lib/supabase/*` is a **compat shim** over cookies + `/auth` endpoints (no Supabase service). Google OAuth via `/auth/google/*`. Roles come from `profiles/me`: `admin`, `manager`, agent via `agent_id`/`agentDashboardApi.getSelf()` |
| Tests | 34 Jest test files, Cypress configured; scripts: `typecheck`, `lint` (max-warnings=0), `test`, `build` |
| Analytics / errors | PostHog, Sentry, Cloudflare beacon, PWA service worker + install banner |

## 2. Routes

Public shell (`(public)/layout.tsx`: `PublicHeader` + `Footer` + `ContactFollowUp`, campus hard-coded to `dekut`):
`/` home, `/hostels`, `/hostels/[county]/[area]`, `/hostels/[county]/[area]/[slug]` (detail, 769 lines), `/bnb`, `/bnb/[id]`,
`/browse`, `/search`, `/areas/[market]/[place]`, `/near/[market]/[landmark]`, `/p/[slug]`, `/listing/[id]` (redirects to slug),
`/saved`, `/compare` (1435 lines), `/book-tour`, `/agents`, `/agents/[slug]`, `/agent/[id]`, `/listers/[slug]`, `/c/[token]`,
`/verify`, `/verify/records`, `/verify/report`, `/auth/login`.
Outside the public layout: `/videos` (`(videos)`), `/account`, `/account/book-tour`, `/policy`, `/terms`, `/offline`, `not-found`, `error`.
Roles: `/dashboard/*` (agent: listings, new, edit, bnb, hostels, leads, tours, earnings, payment, analytics, profile),
`/admin/*` (20 pages incl. operations, legal, feedback, tours, users), `/manager/*` (12 pages incl. operations, requests, applications).
API/route handlers: `api/auth/check-email`, `campuses/create`, `healthz`, `images/process`, `listing-views`, `push/*`, `tour-bookings`,
`track-lead`, `upload-url`; `auth/google/{start,callback}`, `auth/logout`, `auth/refresh`.

## 3. Features and where they live

| Feature | Location | Backend-backed? |
|---|---|---|
| Home collections | `(public)/page.tsx` → `ExploreDiscovery` (categories Hostels / **RumiaBnB** / Apartments), `ForYou`, `ListingSection` x3 (Popular by views, New, Affordable). Announcements banner | Yes: `listingsApi.getFeedServer` with `sort`, `property_type`, `campus_slug` |
| Header search | `components/layouts/navbar-search.tsx` (953 lines) in `PublicHeader`; also `/search`, `/browse`, filter stores | Yes |
| Property detail | `hostels/[county]/[area]/[slug]/page.tsx`, `bnb/[id]/page.tsx`, `components/gallery`, `reviews`, `discovery/property-extras` | Yes |
| Videos | `/videos` → `VideosFeed` → `VideoItem` → `YouTubeEmbed` | Yes, but one **YouTube id per listing** (`listings.youtube_id`); see §7 |
| Wishlist | Signed in: `GET /profiles/me/wishlist`; anonymous: `/api/v1/saves` (browser-kept). `SaveButton` + `wishlist-store`. `/saved` redirects signed-in users to `/account?tab=saved` | Yes |
| Compare | `compare-store`, `CompareTray` (mounted in root layout), `/compare` | Client store; page loads real listings |
| Tours | `/book-tour`, `/account/book-tour`, `account-tours-tab`, `edit-tour-modal`, `toursApi`, actions `tour-bookings` / `student-tour-bookings`, admin/agent tours pages | Yes (statuses incl. cancelled, completed, no_show) |
| Find Me a Hostel | `account/find-me-a-hostel.tsx` (1352 lines): create / edit / cancel / delete requests; fields phone, zone, budget, gender, room type, stay preference, furnishing, move-in date, requirements, consent checkbox | Yes: `hostel-requests` actions |
| Feedback | `account-feedback-tab`, `components/feedback/feedback-form`, `actions/feedback`, admin `/admin/feedback` | Yes |
| Account settings | `account-settings-tab` (profile, campus), `profile-completion-modal` (blocking until phone + campus set, session-dismissible), `push-notification-setting` | Yes (`profilesApi`, `profile-save`) |
| Agent application | `account-agent-application-tab`, `actions/agent-application` (hidden once the user is an agent) | Yes |
| Role entry points | `AccountHeader` → `DashboardSwitcher`: Student `/account`, Agent `/dashboard` (needs agent), Admin `/admin` (role admin), Manager `/manager` (manager or admin), Site `/` | Yes; server layouts enforce redirects |
| Notifications | `components/notifications/notification-bell.tsx`: real unread count, list, mark-read, navigates to `url`. **Rendered only in `ManagerHeader`.** Push: `PushNotificationPrompt`, `push-notifications-card`, `usePushSubscription`; Admin/Agent headers need checking (unverified) | Yes (`actions/notifications`) |
| Legal | `/policy`, `/terms` render admin-edited HTML from `getPublishedLegalDocument('privacy'|'terms')`; admin editor at `/admin/legal`. Footer links `/policy` and `/terms` | Content lives in DB, **not in repo** |
| Error/empty/loading | `app/error.tsx`, `not-found`, `account/loading.tsx`, `videos/loading.tsx`, `ui/{empty-state,error-state,async-boundary,error-boundary,skeleton}` | Mixed |

## 4. Shared layouts today (the problem)

Five independent shells, each with its own header and `max-w-6xl` container:
1. Public: fixed 56px `PublicHeader` (logo, search, Videos, Wishlist) + dark `Footer`.
2. Account: `AccountHeader` (identity + Home/Browse/Agents) + `DashboardSwitcher` pill bar, on `/account`, which sits outside `(public)` and so has no `PublicHeader`.
3. Agent / Admin / Manager: `AgentHeader`, `AdminHeader`, `ManagerHeader`, each a separate component.
4. Videos: full-bleed TikTok-style feed, 480px column, `snap-y`. `(videos)/layout.tsx` is a bare fragment, so `/videos` has no header at all.
5. Policy/Terms: their own sticky header and the public Footer.
Plus global `BottomNav` (mobile: Home, Videos, Verify, Account) and `CompareTray` in the root layout.

## 5. Design inconsistencies

- Header differs on every route family; Profile appears as a bottom-tab on mobile, an inline identity block on `/account`, and nowhere on the public header.
- Navigation is duplicated: PublicHeader links + BottomNav + AccountHeader nav + DashboardSwitcher + Footer.
- Home has `bg-white`, root body `bg-slate-50`, videos `bg-muted`, legal `bg-slate-50`, footer is a dark block (conflicts with the all-light brief).
- Videos view is a dark overlay UI (`bg-black` gradients, white frosted buttons) unlike everything else.
- Two colour vocabularies: HSL tokens (`bg-primary`, `bg-muted`) vs raw `emerald-600` / `slate-900`; amber for notification dots.
- Home copy and URLs are DeKUT/student-specific; category label says "RumiaBnB" where the target design says "Short stays".
- Account page repeats the same save/tour data in three places (overview, tabs, `/saved`); `AccountTabs` exists but `page.tsx` no longer renders it.
- Loading/error handling differs per page (custom skeleton on account, `Loader2` on videos, none on others).
- Notification bell is manager-only; students and agents have no entry point though the backend supports it.

## 6. Must be preserved

All routes in §2 and every feature in §3. In particular: `?tab=` deep links on `/account` (`overview, tours, saved, feedback, settings, agent-application`),
profile-completion modal, auth redirects in server layouts and `proxy.ts`, slug redirects, CSP (YouTube frame/script sources), compare tray, contact flow
(`use-gated-whatsapp`, `ContactFollowUp`, reference codes), anonymous saves, push opt-in, JSON-LD and metadata, `revalidate` settings.

## 7. Findings that change the brief

1. **Video dimensions are not available.** Backend stores `youtube_id` and an agent-set `is_youtube_shorts` flag (default false, so a weak signal); no width/height. (Correction added in Phase 4.) The embed is YouTube's iframe, so "use the actual media dimensions" and a custom `<video>` player with progress and fullscreen are not possible without a backend change. Without it the drawer can use a 9:16 frame for all videos (the brief says most are portrait) and document that landscape ones will letterbox. The YouTube IFrame API can still give play/pause, mute, seek, progress and fullscreen of the player element.
2. **Current player autoplays** (muted) the active item and activates on scroll. The brief forbids that; `YouTubeEmbed` needs reworking.
3. **Ratings/reviews:** listing has a numeric `rating` and reviews exist, but the screenshot's "4.6 (24 reviews)" needs a review count field; confirm it is in the feed payload before showing it (unverified). No fabricated values.
4. **"Recommended for you"** exists as `ForYou` with `lib/personalisation.ts`; label only if its strategy is real (unverified). Popular = most viewed, New = newest, Affordable = cheapest: those are defensible labels.
5. **Messaging** does not exist; none will be added. **Distance** ("5-10 min walk") maps to `distance_category`.
6. **Legal copy is DB content**; I cannot judge completeness. Gaps to report rather than fill: whether the policy names PostHog, Sentry, Cloudflare, Google sign-in, YouTube embeds, R2 storage, push subscriptions, WhatsApp hand-off; retention periods; contact/DPO details; Kenya Data Protection Act references. Needs legal review.
7. Local dev stack was down during this audit; the e2e checks later need `scripts/local-dev/up.sh` (not re-runnable once seeded).

## 8. Proposed architecture

- New `components/shell/`: `AppShell` (grid: sidebar / header / main / optional right panel), `SideNav` (collapsible rail, drawer on mobile, Home, Explore, Videos, Wishlist + role workspaces when authorised; Privacy/Terms at the foot), `TopBar` (single search entry, filter affordance, `NotificationBell`, `ProfileMenu`), `ShellProvider` (collapse state, video drawer state, persisted in localStorage with fallback).
- Apply it through a route-group layout so `(public)`, `/account`, `/saved`-style pages, `/policy`, `/terms` and `(videos)` share one shell. Agent/Admin/Manager keep their own section navigation inside the shell's main area at first (they have role-specific menus that must not be lost), then move their header content into the profile menu / sidebar section.
- Tokens: extend `themes.css` (porcelain surfaces, pale-neutral secondary, Rumia green, navy text, border, radius, shadow) and migrate shared components to them; routes adopt gradually.
- Mobile: keep `BottomNav` as the compact nav but built from the same item list; no second system.
- Video drawer: `VideoDrawer` fed from the existing feed endpoint, explicit-play `YouTubePlayer` (thumbnail first, iframe created only on Play), 9:16 frame, details/actions from the listing record, later items in scroll flow; narrow screens open it full-screen.
- Account: one page, sections (overview, activity, Find Me a Hostel, feedback, settings, role tools) reusing the existing tab components; header/DashboardSwitcher removed in favour of the shell.

## 9. Implementation sequence

1. Tokens + shell + profile menu + bell + legal links (Phase 2); `/account` and home on it.
2. Home redesign and cards (Phase 3), including category labels and honest collection gating.
3. Video drawer and mobile viewer (Phase 4).
4. Account sections (Phase 5).
5. Property detail, wishlist, compare, tours polish (Phase 6).
6. Legal pages layout + notification states (Phase 7).
7. Interaction and a11y pass (Phase 8); full regression and responsive test with the local stack (Phase 9).

## 10. Risks and dependencies

- 5 shells and 100+ routes: change layouts via route groups, not per page; regression test every group.
- Replacing the videos route layout touches CSP-sensitive YouTube embeds.
- Auth guards live in server layouts; the shell needs the user/role without breaking those redirects (fetch role once server-side, pass down).
- `BottomNav` and `MobileMain` padding hacks must be reconciled with the shell's scroll container to avoid double padding.
- Search component is 953 lines with its own overlay: reuse it, do not rewrite.
- Backend changes that may be genuinely required: video dimensions/orientation; review count in feed payload (if absent); a notifications entry for non-manager roles needs no backend change.

## 11. Acceptance criteria

Shell: one header and one nav system on every non-role route; profile menu top-right; Privacy/Terms in sidebar foot and mobile menu; no Messages item.
Behaviour: all routes in §2 still load, direct and on refresh; `?tab=` links work; role pages still redirect unauthorised users.
Video: no autoplay, one playing at a time, 9:16 frame, later videos reached by scrolling.
Quality: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass; checks at 1440x900, 1280x800, 768x1024, 390x844 with no horizontal overflow; no new console errors.
