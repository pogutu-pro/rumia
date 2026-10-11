# Application shell redesign: final integration report

Branch `feat/app-shell` (uncommitted). Date: 2026-10-10. Companion documents: `APP_SHELL_AUDIT.md`, `LEGAL_GAPS.md`.
Everything below was exercised against the local stack (local Postgres, backend on :8000, Next on :3000, and a
production build served on :3001 for the route sweep). Headless Google Chrome via Playwright was the browser.

## What changed

- **Shell** (`web/src/components/shell/`): one sidebar (collapsible rail, drawer below `lg`), one header (search with its filter
  affordance, notifications, profile menu), skip link, a single `<main>` landmark, light tokens in `themes.css`/`globals.css`.
  Applied to the public routes, `/account`, `/videos`, `/policy`, `/terms`. Agent, admin and manager areas keep their own
  headers (their section menus are role-specific); they are reachable from the profile menu and the account page.
- **Home**: category pills (Hostels, Short stays, Apartments), area chips (names and slugs merged), uniform cards, container-query rows,
  collections gated on real data. No hero, no second search.
- **Videos**: portrait 9:16 player, explicit Play, one player at a time, custom controls, details and actions from the listing record,
  more tours below the first screen, right drawer on home at 1280px and up, full page at `/videos` elsewhere.
- **Account**: sections (activity, Find Me a Hostel, feedback and settings, workspaces by permission), real inline validation on Find Me a
  Hostel, Escape closes its dialogs.
- **Property workflows**: Back on property pages returns to the previous in-app page (search params kept) and falls back to the list for
  direct visits; wishlist load failure shows an error with retry instead of an empty list; unsave failure reports itself; compact
  empty-photo gallery.
- **Notifications and legal**: bell rebuilt (Escape, focus return, error and empty states, mark all read, real counts only); legal pages
  have readable spacing; `LEGAL_GAPS.md` lists what the documents do not cover.
- **Accessibility**: primary green darkened to meet 4.5:1, slate-400 text raised, a main landmark, h1s, form labels.

## Verification (final run, after the follow-up work)

| Check | Result |
|---|---|
| Web: `tsc --noEmit`, `eslint . --max-warnings=0` | pass |
| Web: `jest` | 37 suites, 284 tests pass |
| Web: `next build --webpack` | pass (final build ran after the last code change except three small fixes listed under "After the final build") |
| Backend: `pytest tests` | 300 pass |
| Backend: `pytest tests_pg` (real Postgres) | 40 pass, 1 fails for a data reason: `test_alerts_email_only_new_matches...` expects an empty `saved_searches` table, and the local dev database holds one saved search from 2026-10-09. Discovery code was not touched. |
| API contract | `backend/openapi.json` and `web/src/lib/api/schema.d.ts` regenerated; the only change is `review_count` |
| Route sweep, production build, signed out | 66 routes x 1440 and 390 wide: 132 checks, no flags |
| Route sweep, production build, signed in as admin | 132 checks: no overflow, no page errors, the former React #418 pages included |
| axe-core (WCAG A/AA + best practice) | no violations on home, videos, hostels, verify, account, compare, terms, policy, manager, dashboard, admin official hostels (the last three re-scanned in dev after fixes) |
| Browser console on dev, 9 pages signed in (home, videos, hostels, compare, account, account settings, policy, manager, dashboard) | no errors, no hydration warnings, no failed requests, nothing filtered |
| Interactions | save, unsave, badge count, persistence across reload, compare, feedback submit, contact modal from the video panel, bell open/Escape/mark-all-read, profile menu, Find Me a Hostel validation, video play/pause/seek/mute/switch, portrait (0.563) and landscape (1.778) frames, Back keeps `?q=` |

After the final production build, three small things changed and were verified in the dev server only (axe and console scan), not in
another production build: manager and admin contrast and heading fixes, the sidebar `aria-pressed` hydration fix, and the
production-only analytics script. Everything else in the table ran against the final build.

Widths used: 1440x900 and 390x844 for the sweeps; 1280x800 and 768x1024 for overflow checks on home and a few pages only.

## Bugs found and fixed

- React hydration error #418 on `/admin/settings`, `/dashboard/profile`, `/manager`, `/manager/settings`: `usePushSubscription` started with
  `loading = !canInitializeSync()`, which reads `window`, so the server and the first client render differed. It now always starts as
  "checking" and settles after mount (it previously also showed "Checking notifications..." forever where push is unavailable).
- Home page overflowed sideways by 1100px once cards had ratings: the screen-reader text in a card is absolutely positioned and the
  card was not `relative`, so it escaped the scroller. The card is now `relative`.
- Sidebar `aria-pressed` on Videos caused a dev hydration warning (depended on screen width); now mount-safe.
- Local dev noise removed: an empty PostHog token now disables analytics quietly, and the Cloudflare beacon is production-only.
- Manager and admin pages: amber and grey text contrast, one unlabeled select, heading order.
- Sidebar listed both Verify and Agents, but `/agents` redirects to `/verify`: Agents removed.
- Account loading skeleton showed the old header; replaced.
- Account Wishlist swallowed load errors and showed an empty list: error state with retry added.
- Find Me a Hostel date inputs had no label; required fields were not announced.
- Legal pages had no section spacing because of a `space-y-0` class on the wrapper.
- Sticky bars on property and compare pages sat under the shell header: offset corrected.
- `/verify` mode buttons overflowed by 18px at 390 wide: now wrap.
- Colour contrast: primary green and several slate greys failed AA.

## Remaining issues and things not verified

- Not tested: tour booking creation, tour cancel/edit, agent listing creation, admin and manager actions beyond page load, agent
  application submit, Find Me a Hostel submission (it creates a fee-bearing request), push notification opt-in, iOS fullscreen video,
  unmuted audio, real photos (the local data has none; ratings were tested with four local test reviews), a real consultation fee in the contact modal.
- Home headings still say "near DeKUT" (campus-neutral copy is item 9 in `REMAINING.md`).
- Duplicate `/profiles/me` request: the shell and the account page each load the profile.
- The agent, admin and manager areas still use their own headers and the mobile bottom bar.
- A production build served on another port cannot call the local API (CORS allows `localhost:3000` only).

## Backend work (done in the follow-up)

- `GET /listings` and `GET /listings/{id_or_slug}` now return `review_count` and a real `rating`: the average (one decimal) of
  published reviews, the same definition the property page's review summary uses. Previously `rating` always came from
  `listings.rating`, a column nothing updates, so it was always 0. One grouped query serves a whole page of listings.
  No migration. `backend/openapi.json` and `web/src/lib/api/schema.d.ts` were regenerated (only `review_count` was added).
  Tests: a real-Postgres test (`tests_pg`) and API tests; the home cards now show `4.3 (3)` and nothing when there are no reviews.
- Video orientation needed no backend change: the listing form already sets `is_youtube_shorts` from the pasted URL
  (a `/shorts/` link). The player now uses 9:16 for those and 16:9 for normal links. A vertical video uploaded as a normal
  YouTube video is still treated as landscape; YouTube pillarboxes it inside the 16:9 frame.

## Files changed

About 155 modified files, mostly small class-name token changes (bulk replacement of `emerald-600`, `slate-400` text and a few slate
greys). The substantive changes are in:

`web/src/components/shell/*` (new), `web/src/components/videos/*`, `web/src/components/home/*`, `web/src/components/notifications/notification-bell.tsx`,
`web/src/components/pwa/{BottomNav,MobileMain,PushNotificationPrompt}.tsx`, `web/src/components/layouts/public-footer.tsx`,
`web/src/components/policies/legal-document-body.tsx`, `web/src/app/(public)/{layout,page}.tsx`, `web/src/app/(videos)/*`,
`web/src/app/account/*`, `web/src/app/{policy,terms}/page.tsx`, `web/src/app/(public)/{hostels,bnb,compare,verify}/*`,
`web/src/app/(public)/listing/[id]/image-gallery.tsx`, `web/src/styles/{themes,globals}.css`, `web/src/types/youtube.d.ts`,
`web/src/lib/utils/{area-label,video-listing}.ts` (new), plus tests and `docs/restructure/*`.
Removed: `public-header.tsx`, `account-header.tsx`, `videos-feed.tsx`, `video-item.tsx`, `youtube-embed.tsx`.

## Running it locally to review (nothing committed)

Branch `feat/app-shell`. Web dev server on http://localhost:3000, backend on :8000, local Postgres in Docker.

    node scripts/local-dev/open-signed-in.mjs /account      # local-only helper (scripts/local-dev is untracked): Chrome signed in as the local test admin
    scripts/local-dev/down.sh                               # stop everything (keeps data)

Local test data added (local database only): four listings have YouTube ids (one marked as a normal link to show the 16:9 frame),
four published test reviews, two test notifications, and a test admin user `shell-test@local.test`.
