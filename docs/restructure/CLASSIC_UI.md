# Classic UI on the new backend (`restructure/classic-ui`)

The frontend is the original one from `main`. The redesign stays on `restructure/m1-live-fixes`. This branch adds the new backend's
features to the pages people already use.

## What was added, and where it shows up

| Feature | Where |
| --- | --- |
| Contact without sign-in; reference code in the WhatsApp message; "did they reply?" prompt | Listing page contact modal (owner/agent choice, fee and full notices unchanged); prompt in the public layout |
| Saves without sign-in, merged into the account at sign-in | Heart button everywhere; `/saved` signed out; account Saved tab signed in |
| Alerts ("Notify me") and their list | `/search`, area and landmark pages; `/saved`; account Saved tab |
| Sentence search ("bedsitter near DeKUT under 8k") | `/search`; the navbar sends plain words there, filters keep using `/hostels` |
| On-device personalisation (recent searches, "Picked for you") | Home page; nothing leaves the browser (`lib/personalisation.ts`) |
| Dated facts, similar places, report a problem | Hostel listing page |
| Area, landmark and lister pages | `/areas/<market>/<place>`, `/near/<market>/<landmark>`, `/listers/<slug>`; in the sitemap |
| Owner: needs-attention panel, enquiries with outcomes, "still available", team | `/dashboard`, `/dashboard/leads`, `/dashboard/listings`, `/dashboard/profile` |
| Staff: review queue, reports, stale listers, market health | `/admin/operations`, `/manager/operations` |
| Links the backend sends | `/p/<slug>` redirects to the listing; `/c/<token>` is the owner's one-tap confirm page |

## Backend fixes made while doing this

- Admin verify / un-verify now reaches the property model, and registry evidence is revoked as well as added.
- Role changes made on the old Users / Managers / approval screens keep `staff_assignments` in step, so a newly promoted admin or manager can use the ops endpoints.
- `scripts/check-projection-drift.sql` lists any listing that disagrees with its copy in the property model. Run it on a copy of production before deploying.

## Checks

```
cd backend && uv run pytest tests -q
cd backend && TEST_DATABASE_URL=postgresql+asyncpg://… uv run pytest tests_pg -q   # real Postgres, see HANDOFF.md
cd web && pnpm typecheck && pnpm lint && pnpm test && pnpm build
psql "$DATABASE_URL" -f scripts/check-projection-drift.sql                          # expect zero rows
```

## Not done / not verified

- Not viewed in a browser (the browser extension was not available). Flows were exercised over HTTP against a local database.
- Photo upload still uses the old uploader, not `/media/uploads`.
- WhatsApp alerts are accepted but not sent until a provider is connected; email alerts work.
- Copy and URL defaults are still DeKUT / Nyeri / "students". The backend supports more markets and kinds.
- The Alembic migrations have only run on scratch and local databases, never on a copy of production.
