# Progress log

One line per commit on `restructure/m1-live-fixes` (milestone · task · status · follow-up).
Branch is **not pushed** and **not deployed**. Newest first.

## Milestone 4 · New experience (web)

| Commit | Milestone · task | Status | Follow-ups / deviations |
|---|---|---|---|
| `a861c04` | M4 · Task 8b delete replaced routes | Done | Deleted only `dashboard/page.tsx` + `dashboard/leads/page.tsx` (→ `/workspace`) with exact config redirects; `(admin)`/`(manager)` deliberately kept (no replacement yet). See HANDOFF §8. |
| `c33f20f` | M4 · Task 8a ops console | Done | `/ops` + queues/review/reports/health behind the session. Rendered as HTML only; scratch DB down. |
| `b95b8f5` | M4 · Task 7 lister workspace | Done | `/workspace` on the rebuilt chrome. Create/edit still uses the legacy editor. |
| `648e4ed` | M4 · Task 6 Explore map | Done | List/map split, lazy behind `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Map UI not rendered live (no browser). |
| `53f80ac` | M4 · Task 5b delete old pages | Done | Old public trees + orphans removed; `BookTourForm` kept in `components/legacy` for `/account/book-tour`. |
| `010fea2` | M4 · Task 5a redirects | Done | `next.config.mjs` permanent redirects for every ux/03 IA-table path. Legacy `/agent(s)/*` → Explore (no public legacy-id lookup). |
| `3e97b40` | M4 · Task 4b remaining pages | Done | Lister `/l/[slug]`, `/{market}/{place}`, `/{market}/near/{landmark}`, `/c/[token]`. |
| `f07bf36` | M4 · Task 4a Help & safety | Done | `/help`, `/check`. |
| `5328934` | M4 · Task 3 sign-in sheet | Done | In-context sheet; `/auth/login` kept as fallback. |
| `bc461c9` | M4 · Task 2 Saved | Done | Places/alerts tabs, device saves, compare, alerts. |
| `b754a18` | M4 · Task 1 chrome | Done | New header/footer; legacy bottom nav kept for old areas. |
| `0eac929` | M4 · property page + Explore | Done | `/p/{slug}`, design tokens, core components. |
| `d5dbd41` | M3 · web client/contact/saves | Done | One-tap contact, account-free saves, typed client, events. |

## Milestones 1–3 (backend + live fixes)

Stabilisation, foundations and backend for the new model were completed earlier on this branch
(`5b690eb` … `ffd1971`, `59d527a` … `7b04799`). See HANDOFF §"Done" for the verified list.
Backend: 298 unit + 33 real-DB tests. Web at handoff: 224+ tests.

## Task 9 · Finish pass

- `pnpm build` — passes (58 routes generated); `/ops*` and `/workspace` present.
- Accessibility — reviewed at code level: every `<input>` in the new `components/rumia`/`(public)`
  screens has a `<label>` or `sr-only` label; all `<Image>`s carry `alt`; the mobile map overlay is
  `role="dialog" aria-modal="true"` with an `aria-label`, Esc-to-close and scroll lock.
  **Not run:** axe or a browser — no browser available in this environment.
- Responsive — reviewed at code level for 360/768/1023/1024/1366 px (single-column by default,
  `sm:`/`lg:` split points). **Not screenshotted** — no browser.
- Docs — `README.md` routes updated; `web/.env.example` already lists the Maps vars.
- Checklists — HANDOFF Task 8/9 annotated; IMPLEMENTATION_GUIDE §7 ticked for verified items only.

## Known gaps (not verified here)

- No browser: new UI checked as HTML/typecheck/lint/tests only.
- Scratch DB not running: API-backed pages 404 on empty data.
- Alembic `0002`–`0006` only rehearsed on a scratch DB — must run against a production copy before deploy.
- `(admin)`/`(manager)` and the rest of `(dashboard)` remain from the old build.
