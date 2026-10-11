# Rumia mobile-first plan

Status: **plan for review. No application code has been changed.** Date: 2026-10-11. Branch base: `main` (42480fa).
Builds on `APP_SHELL_AUDIT.md` and `APP_SHELL_REPORT.md` (the desktop-first shell merged on 2026-10-10).
Everything below comes from reading code, not from a browser. Items marked *(unverified)* need a live check in Phase M0.

## 1. Where we are

The shell merged yesterday was designed at 1440px and then checked at 390px for overflow only. On a phone it still behaves like a
desktop app with a drawer:

| Area | Current behaviour on a phone | Problem |
|---|---|---|
| Primary navigation | `TopBar` shows a **hamburger** (`top-bar.tsx`) that opens a left `Sheet` containing the sidebar list (`app-shell.tsx` `MobileNav`) | The thing the brief rules out. Every destination costs two taps. |
| Bottom nav | `pwa/BottomNav.tsx` is hidden everywhere except `/dashboard`, `/admin`, `/manager` (`usesBottomNav`). Its items (Home, Videos, Verify, Account) are a **second, separate list** from `shell/nav-config.ts` | Two nav systems. Public pages have no bottom bar at all. |
| Breakpoints | Bottom nav uses `md:hidden` (768px); sidebar and drawer use `lg` (1024px) | Between 768 and 1023px the nav is a hamburger on some routes and a bottom bar on others. |
| Header | 64px (`--shell-header-h`): hamburger, logo, search pill, bell, profile menu | Crowded at 360px; search pill and avatar compete for ~200px. |
| Search | `navbar-search.tsx` (953 lines). On mobile it opens a panel pinned at a hard-coded `top-[56px]` under a header that is now 64px; filter row has three differently coloured pills (emerald, rose, black) and a "Book a Tour" button inside the filter row; uses `framer-motion` | Overlay is not full-screen, misaligned with the header, visually inconsistent, and the page behind stays scrollable *(unverified)*. |
| Property detail | Fixed `bottom-0` action bar on `lg:hidden` (`hostels/.../[slug]/page.tsx:740`, `bnb/[id]/page.tsx:551`) | Will collide with a bottom nav. Content padding so the bar does not cover the last section is unverified. |
| Compare tray | Mobile tray is pinned at `bottom: 4rem + safe-area` "above the bottom nav" | That nav does not exist on public pages, so today the tray floats 64px above nothing. |
| Other fixed layers | `InstallBanner`, `PushNotificationPrompt`, `GestureTutorial`, `FloatingActionButton` each hard-code `4rem`/`4.25rem` bottom offsets | No shared "bottom inset" value; any change to the nav height means editing five files. |
| Videos | Already portrait 9:16, explicit Play, one player at a time, `/videos` full page below 1280px | Page height ignores a bottom bar; `videos/loading.tsx` still uses the old `64px` maths. Pause on route change / tab hidden *(unverified)*. |
| Account | Single scroll page; sections via `?tab=`; 1437-line Find Me a Hostel; 5 tab components | Section switching on a phone is a back-link to Overview, no persistent section control; heavy client-side waterfall on load. |
| Role areas | Own headers (`agent-header`, `admin-header`, `manager-header`) plus the old bottom bar | Mobile menus inside them not audited *(unverified)*. |
| Dead code | `SwipeNavigator`, `AnimatedMain`, `GestureTutorial`, `InstallButton` are not imported anywhere except by each other | Candidates to delete in M1; swipe-to-navigate would fight a bottom bar anyway. |

What is already good and must be kept: container-query card rows on home, 9:16 explicit-play player, `FilterBottomSheet`
(a real bottom sheet), `BottomSheet`/`Sheet`/`Drawer` primitives, wishlist badge count, `dvh` units, safe-area padding on the old
bar, light tokens in `themes.css`.

## 2. Bottom navigation: validated choices

Your five are right. Checked against real routes and the shell's own `PRIMARY_NAV`:

| Tab | Goes to | Active on | Notes |
|---|---|---|---|
| Home | `/` | `/` | Recommended, collections, category pills. |
| Explore | `/hostels` | `/hostels`, `/bnb`, `/browse`, `/search`, `/areas`, `/near`, `/p/`, `/listing` | Category switch (Hostels / Short stays / Apartments) lives at the top of this page, see §4. |
| Videos | `/videos` | `/videos` | Full page on a phone. The right-hand drawer stays a desktop-only (≥1280px) feature. |
| Wishlist | `/saved` | `/saved`, `/compare` | Saved count badge (already in the store). Anonymous saves work, so no login wall. Compare is reached from here and from the compare tray. |
| Account | `/account` (signed in) or `/auth/login` (signed out) | `/account`, `/dashboard`, `/admin`, `/manager`, `/auth` | Avatar when signed in. |

**One consequence to decide:** the current sidebar has a fifth item, **Verify** (`/verify`: HAKISA agent checker, official
records, report; `/agents` redirects here). It cannot keep a bottom slot. Proposal: it moves to a "Tools" row at the top of the
Account hub, a card on Home, and stays in the desktop sidebar. Nothing is removed.

Rules for the bar:

- Shown below `lg` (1024px), hidden at `lg` and up where the sidebar takes over. One breakpoint for both, so there is never a gap.
- One component, one item list. `shell/nav-config.ts` gets a `MOBILE_NAV` list; `pwa/BottomNav.tsx` is rewritten to read it and the
  duplicate list is deleted.
- 56px bar plus `env(safe-area-inset-bottom)`; each tab at least 48px wide and tall; label always visible (11px minimum, not 10px);
  active state is colour plus a filled icon, not colour alone; `aria-current="page"`.
- Exposed as CSS variable `--bottom-nav-h` (0 at `lg`+). `<main>` gets `padding-bottom: var(--bottom-nav-h)`. Every other fixed
  layer positions itself from the variable.
- Hidden (immersive mode) on property detail pages and during an open search, where a page-level action bar takes the bottom edge
  (§5, §6). Everywhere else it stays.
- Role workspaces (`/dashboard`, `/admin`, `/manager`) show the same bar, with Account active. Their own section menus remain as
  secondary, in-page navigation (they are role tools, not the app's primary navigation).
- Hamburger and left drawer are removed from `TopBar` and `AppShell`. The legal links move to the Account hub footer and the
  existing page footer.

Mobile header (56px, single row): logo mark · search pill (one tap, fills the remaining width) · bell when signed in. The profile menu
is not shown below `lg`; Account is a tab. At `lg`+ the header is unchanged.

## 3. Feature map: every existing feature to its mobile home

| Feature | Today | Mobile location |
|---|---|---|
| Home collections, recommended ("For you"), announcements | `/` | Home tab |
| Hostels, Short stays (`/bnb`), Apartments (`property_type=apartment`) | Category pills on home; `/hostels`, `/bnb` | Explore tab, category segmented control |
| Areas / near-landmark pages | `/areas/*`, `/near/*` | Explore tab, area chips; deep links unchanged |
| Search, filters, saved-search alerts | header search, `/search`, `/browse` | Full-screen search from any header (§4); alerts stay on results |
| Property detail, gallery, reviews, contact (WhatsApp ref code), book tour, notify me | detail routes | Same routes; action bar (§5) |
| Video tours | `/videos`, desktop drawer | Videos tab |
| Wishlist | `/saved`, account Saved tab | Wishlist tab; account Saved tab keeps working |
| Compare | `/compare`, tray | From Wishlist and tray |
| Tour bookings and visits | Account Tours tab, `/account/book-tour`, `/book-tour` | Account hub "Activity" |
| Find Me a Hostel | Account | Account hub, own card (also linked from empty search results) |
| Feedback, settings, push opt-in, agent application | Account tabs | Account hub rows; `?tab=` deep links keep working |
| Verify / HAKISA, official records, report | `/verify*` | Account hub "Tools" row, Home card, desktop sidebar |
| Notifications | Bell (signed in) | Mobile header bell |
| Agent dashboard, admin, manager | `/dashboard`, `/admin`, `/manager` | Account hub "Workspaces" (permission-gated, same checks as the profile menu) |
| Privacy, Terms | sidebar foot, footer | Account hub footer, page footer |
| Install / push prompts | banners | Stay, repositioned on `--bottom-nav-h` |
| Sign in / out | profile menu | Account tab (sign-in prompt when signed out; sign out at bottom of hub) |

## 4. Layout strategy (mobile first)

CSS is written for the narrowest case and widened with `min-width` queries. Breakpoints: **base** 320–639 phone, **sm** 640 large
phone / small tablet, **md** 768 tablet portrait, **lg** 1024 shell switches (bottom nav → sidebar), **xl** 1280 video drawer.
Components that already use container queries (home rows) keep them; others move from viewport to container where they live in
variable-width columns.

- **Page frame:** single column, 16px gutters, max content width grows with breakpoint. No horizontal scroll except deliberate
  chip/card rails. Body already clips `overflow-x`; that hides bugs, so the test harness (§8) measures `scrollWidth`.
- **Cards:** one column of full-width cards at base (image 4:3, price and title first), two columns from `sm`, three from `lg`.
  Horizontal rails on home show a peek of the next card so the scroll affordance is visible. Images use `next/image` with correct
  `sizes`, the first rail image eager, the rest lazy, and the existing R2 variants.
- **Touch:** targets at least 44×44 (48 in the nav); 8px minimum between adjacent targets; inputs 16px font to stop iOS zoom;
  `touch-action: manipulation`; `:active` feedback instead of hover-only states; no hover-only information.
- **Typography/spacing:** base text 16px, secondary 14px, nothing below 12px; line length capped by the gutters.
- **Home:** header, category pills (Hostels / Short stays / Apartments, sticky under the header), area chips rail, then collections.
  No hero and no second search (as agreed in the shell work). Verify card near the bottom.
- **Explore:** category segmented control, area chips, sort, result list with infinite scroll or "Load more" (decide in M2 from
  measured payload), "Filters" button opens the existing `FilterBottomSheet`.
- **Search (one tap):** tapping the header pill opens a **full-screen layer** (route-less overlay, history entry so Back closes it, body scroll locked, focus in the input). Contents, top to bottom:
  input with back arrow and clear; category segmented control; the filters that matter most as one-tap chips (price, room type, distance, gender); "All filters" (the existing bottom sheet); recent searches; live results below as you type; a sticky bottom button "Show N results". The existing `parseQuery` smart-token chips stay. The three coloured pills and the "Book a Tour" button leave the filter row (booking is on the property and Account). Reuse `NavbarSearch`'s state and autocomplete logic: split the presentation out, do not rewrite it. Drop `framer-motion` from this path.
- **Property detail:** gallery first (swipe carousel with counter, tap for the existing lightbox); price, title, area, key facts;
  a sticky **action bar** (Contact · Book a tour, Save and Share in the header) that sits on the bottom edge with the nav hidden;
  amenities as a compact grid with "show all"; description clamped with "Read more" (exists); map and distance; reviews summary then list; similar listings rail.
  The two duplicated bars (hostel, bnb) become one `PropertyActionBar` component.
- **Videos:** see M4. The existing player is kept.
- **Wishlist/Compare:** list of saved cards with remove and a sticky "Compare (n)" button; `/compare` becomes a horizontal comparison with sticky first column on phones instead of a desktop table shrunk down. *(1435-line file: scope in M5.)*
- **Account hub:** `/account` becomes a mobile-first menu: profile header, "Activity" (tours, saved), "Find Me a Hostel", "Feedback", "Settings", "Tools", "Workspaces" (gated), legal, sign out. Each row opens its section as a page with a back arrow, using the existing tab components and `?tab=` URLs. Desktop keeps the current layout.

## 5. Fixed-element policy

One vertical stack, bottom to top, all computed from CSS variables defined once in `themes.css`:

1. Bottom nav (`--bottom-nav-h`, 0 at `lg`+) or, on detail pages, the property action bar (`--bottom-bar-h`).
2. Compare tray, install banner and push prompt sit above whichever bar is present; only one of the three shows at a time.
3. Toasts above that.

`<main>` reserves the space it needs so the last item is always reachable. Safe-area insets are applied to the bar itself, not to
`<main>`. Sheets and the search layer use `100dvh` and `overscroll-behavior: contain`.

## 6. Performance plan

Measure first (M0), then spend effort where the numbers say. Starting hypotheses from the code:

- Fonts: two Google families, `preload: true` on both. Keep Inter only on the critical path; load Jakarta for headings with
  `display: swap` and subset weights.
- Header search ships `framer-motion` and a 953-line component on every route. Lazy-load the full-screen search on first tap; the
  header renders only the pill.
- `ShellProvider` and `account/page.tsx` both call `/profiles/me` (noted in the previous report). Share one fetch through context.
- Account page is a client component that awaits session, then profile, then tours/saved/campuses/agent application. Parallelise
  the critical calls; lazy-load `find-me-a-hostel` (1437 lines), `edit-tour-modal` and the settings tab.
- `/compare` (1435 lines, client) and `hostels-search` (609) are loaded on demand; check bundle sizes in the Next build output.
- Video: nothing but the poster loads until Play (already true); also pause and destroy the player on route change,
  `visibilitychange` and when another video is selected; use `hqdefault` posters sized for the viewport; no preconnect to YouTube
  except on `/videos`.
- Images: `sizes` per breakpoint, no `unoptimized` on content images, explicit dimensions to avoid layout shift, `priority` only for
  the first card.
- Network: request only fields shown on cards; short `revalidate` on listing feeds is already in place; the service worker keeps the
  offline page. Check API payload sizes for list endpoints under Slow 4G.
- Targets to confirm in M0 and then hold (mobile profile, Slow 4G, mid-range Android): LCP ≤ 2.5s on home, CLS ≤ 0.1, INP ≤ 200ms,
  initial JS per route that we own does not grow from the M0 baseline. These are targets, not measured facts yet.

## 7. Phases

Each phase is its own branch and PR from `main` (`feat/mobile-m1-…`), keeps `tsc`, `eslint --max-warnings=0`, `jest` and
`next build` green, and ends with the browser checks in §8 before the next phase starts. Rollback is reverting the PR.

**M0. Baseline and decisions (no product code).**
Run the local stack; record 360/390/430/768/1024 screenshots of home, hostels, search open, detail, videos, saved, compare,
account (each section), dashboard, admin, manager; run Lighthouse mobile on Slow 4G; record bundle sizes; check the *(unverified)*
items above (search overlay scroll lock, detail bottom padding, workspace headers' mobile menus, video pause on navigation).
Add the overflow/overlap test harness (§8). Output: `MOBILE_BASELINE.md`.

**M1. Core mobile architecture.**
`MOBILE_NAV` in `nav-config.ts`; rewrite `BottomNav` on it at `lg:hidden`; remove hamburger, `MobileNav` sheet and mobile use of
the profile menu; 56px mobile header with search pill and bell; `--bottom-nav-h`/`--bottom-bar-h` variables; `<main>` padding;
re-anchor `CompareTray`, `InstallBanner`, `PushNotificationPrompt`, `FloatingActionButton`; hide the bar on detail routes; show it
in role workspaces; delete dead PWA components; fix the 768–1023 gap. Account tab behaviour for signed-out visitors.
*Exit:* every tab reachable in one tap on all routes; no content hidden behind the bar at 320px; desktop pixel-identical.

**M2. Discovery.**
Home on mobile (sticky category pills, area rail, card sizes); Explore with Hostels / Short stays / Apartments; full-screen
search layer and one-tap filters; empty and error states; Find Me a Hostel entry point from empty results.
*Exit:* search opens in one tap, shows filters immediately, closes with Back, no duplicate search bar anywhere.

**M3. Property detail and actions.**
Gallery, price block, facts, amenities grid, description, location, reviews; shared `PropertyActionBar`; both detail routes.
Contact (WhatsApp with reference code), book tour and notify-me flows unchanged in behaviour.
*Exit:* all actions reachable without covering content; reference-code contact verified end to end.

**M4. Videos.**
`/videos` height and layout against the bottom nav; keep explicit play, one at a time; pause on switch, navigation, tab hidden
and unmount; "More tours" switches without navigation (already in place: verify); details and actions visible without leaving the
video; safe-area handling in the controls; fix `loading.tsx`; landscape YouTube handled by letterboxing (no backend change).
*Exit:* nothing plays unprompted; switching never leaves two players alive; no full-page navigation on switch.

**M5. Wishlist, compare, account, forms.**
Wishlist page for phones; `/compare` mobile layout; Account hub and section pages; Find Me a Hostel as a stepped form
(same fields, validation and consent, same API); settings, tours, feedback checked for 16px inputs, label association, keyboard
types (`tel`, `inputmode`), sticky submit above the keyboard; profile-completion modal as a full-height sheet.
*Exit:* every `?tab=` URL works; every field of every existing form still present and submitting.

**M6. Role workspaces.**
Audit agent/admin/manager headers and tables on phones; tables become card lists or scroll within a container with a visible
affordance; keep all actions and permission checks. Keep scope tight: usability, not redesign.

**M7. Performance and release.**
Apply the §6 findings with measured before/after; full regression pass; slow-connection pass; real-device pass (iOS Safari, Android
Chrome); update `REMAINING.md` and the docs.

Suggested order of delivery: M0 → M1 → M2 → M3 (these four make the app feel mobile) → M4 → M5 → M6 → M7.

## 8. Test plan

- **Widths:** 320, 360, 390, 430 (phones), 768 (tablet portrait), 1024 (shell switch), 1440. Also landscape phone (844×390) for
  video, search and the action bar.
- **Automated (extend the existing Playwright sweep in `scripts/local-dev`):** for every route at 320/390/768: `scrollWidth ≤
  clientWidth`; no element wider than the viewport; fixed elements do not overlap each other or the last content block; bottom bar
  present/absent as specified; touch targets ≥ 44px for interactive elements in the header, bar, cards and forms; no console errors; axe-core (A/AA).
- **Jest:** nav active-state matrix per route, `MOBILE_NAV` ↔ route existence, search open/close/Back, action bar rendering, video
  one-at-a-time and pause-on-switch.
- **Manual flows (signed out and signed in):** search with filters; save/unsave and badge; contact with reference code; notify me;
  book a tour; start/edit/cancel a tour; Find Me a Hostel including validation; feedback; settings and profile completion; compare;
  video play, switch, background the tab; sign in/out; agent, manager, admin entry and one action each.
- **Throttled:** Slow 4G and CPU 4× slowdown on home, hostels, detail, videos; confirm skeletons, no layout shift, no blocked taps.
- **Not testable here, flag it:** iOS Safari fullscreen video, keyboard resize behaviour, PWA install, push opt-in, real photos and
  real consultation fees. Needs a phone; the earlier report listed these as untested too.

## 9. Decisions needed before M1

1. **Verify placement.** Account "Tools" + Home card + desktop sidebar (recommended), or give Verify a slot and fold Wishlist into Account?
2. **Hide the bottom bar on property detail pages** so the action bar owns the bottom edge (recommended, standard pattern), or keep both stacked (costs ~120px of screen).
3. **Explore target.** `/hostels` with a category control at the top (recommended; reuses everything), or a new category hub page. Apartments currently exist only as a `property_type` filter on the home feed: confirm there are listings to show and whether a dedicated `/apartments` list is wanted.
4. **Account tab when signed out:** go straight to `/auth/login` (today's behaviour) or show a short sign-in page with the benefits first.
5. **Breakpoint** for bar → sidebar at 1024 (recommended; matches the current sidebar) versus 768.

## 10. Risks

- Fixed-layer collisions are the main regression risk; hence the variable-based stack and the overlap test in M0/M1.
- `/compare`, Find Me a Hostel and `navbar-search` are 950–1450 lines each. Plan is to split presentation, not rewrite logic.
- Role pages have their own layouts; changing the bar there touches `usesBottomNav` and `MobileMain` (padding is applied in two places today).
- Auth guards and slug redirects live in `proxy.ts` and server layouts; the work does not touch them.
- Copy and URLs still say "DeKUT"/"students" (REMAINING.md item 9). Out of scope here; keep new strings campus-neutral.
- Not verifiable without a device: iOS viewport/keyboard quirks. Budget a real-device pass in M7.
