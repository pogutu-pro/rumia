# Mobile-first work: report

Branch `feat/mobile-first`, 2026-10-11. Plan: `MOBILE_PLAN.md`. Baseline: `MOBILE_BASELINE.md`.

## What changed
- **M1 navigation:** five-tab bottom bar (Home, Explore, Videos, Wishlist, Account) below `lg`, from one shared list (`MOBILE_NAV`). Hamburger and
  left drawer removed. Hidden on property pages (Contact / Book a tour is the only bar) and sign-in. `--bottom-nav-h` positions main padding,
  compare tray, install and push prompts, and the videos page height. 56px mobile header (logo, search, bell). Verify moved to the Account page and a Home card.
- **M2 discovery:** search is a full-screen layer on phones and small tablets (scroll-locked, Back closes it, one-tap filter chips, recent searches,
  Show results bar); Book a Tour left the filter row; Explore has All / Hostels / Short stays / Apartments tabs; Short stays no longer has a second search box.
- **M3 property page:** prominent price, formatted area, safe-area Contact / Book a tour bar with a spacer; 1024px overflow fixed (also Verify).
- **M4 videos:** pause on tab hidden / page hide; loading skeleton and height account for the bar.
- **M5 forms and account:** inputs 16px on phones, 44px targets in settings and prompts, compact push prompt, Wishlist goes straight to saved places, legal links on the account page.
- **M6 workspaces:** labelled workspace and section chips instead of icon-only buttons; admin listing actions wrap.

## Verified
`tsc`, `eslint --max-warnings=0`, `jest` (38 suites, 310 tests), `next build --webpack`; sweep of 22 routes at 320/360/390/430/768/1024 on the
production build, signed out and signed in: no overflow, no hamburger, no page errors (the only console errors are the production-only Cloudflare beacon blocked by CORS on localhost).

## Not done / not verified
- Find Me a Hostel is still one long inline form (all fields kept); a stepped version is a redesign with submit-flow risk.
- No Lighthouse or slow-network run (no tooling here); no real-device test (iOS Safari video fullscreen, keyboard resize, PWA install, push).
- Remaining axe findings predate this work: colour contrast on `/bnb`, `/search`, property page, dashboard/admin/manager; one unnamed button on account feedback; one unlabeled field on account settings.
- Text under 12px is still common on dashboard, admin and manager pages.
- `/admin/operations` and `/manager/operations` log a 403 locally (not investigated; the work did not touch the API).
- Short-stay property page (`/bnb/[id]`) got the same bar changes but was not viewed (no short-stay data locally).
