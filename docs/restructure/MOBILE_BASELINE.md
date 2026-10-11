# Mobile baseline (M0)

Date 2026-10-11, `main` at 42480fa, local stack, Next **dev** server, headless Chrome, signed in as the local test admin.
Harness: `scripts/local-dev/mobile-sweep.mjs` (22 routes x 320/360/390/430/768/1024). Lighthouse and bundle sizes were **not** run:
the dev server is not representative; do them against a production build in M7.

## Results
- **Hamburger on every shell route** at 320-1024px; bottom bar only on `/dashboard`, `/admin`, `/manager`.
- **No horizontal overflow at 320, 390, 430, 768** on any route. At **1024** the property page (1076px) and `/verify` (1056px) overflow.
- **360 column is incomplete**: 9 routes timed out (dev server stalled mid-run, not a page fault). Re-run in M1.
- **Search pill** placeholder wraps to 2-3 lines at 320/360 and spills out of the pill (screenshots).
- **Home** starts with a large "Find your next place" heading before the category pills, pushing the first card below the fold at 360x780.
- **Property page** shows the raw area slug (`near-gate-a`) as a label. The fixed Book a Tour / Contact bar exists (77px).
- **Enable notifications** card is fixed, 175px tall, on `/account*` and `/saved` at 390x844: it covers a fifth of the screen.
- **Touch targets under 44px** (count per page at 390): home 33, property 31, admin 21, manager 30; header hamburger 40x40, logo 36x40, role-switcher links 36x36.
- **Text under 12px**: home 44 elements, admin 41, manager 45, dashboard 30, account 15.
- **axe (WCAG A/AA, 390px)**: `color-contrast` on `/bnb` (2), `/search` (6), property page (3); unnamed button on account feedback; unlabeled field on account settings.
- **No console errors** on any route.
- Not run: search overlay behaviour, video pause on navigation, workspace header menus (checked by hand in the relevant phase).
