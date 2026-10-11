# What is left

Status as of 2026-10-09. The classic UI on the new backend (PR #6) is merged and deployed. Production is on database
revision `0006` with zero drift, and the server disk is at 26% after clearing 36 GB of Docker build cache.

Details of what shipped: `docs/restructure/CLASSIC_UI.md`.

## Do soon

1. **Check it on a phone.** Nothing has been viewed in a browser, only exercised over HTTP. Open https://rumia.co.ke and try
   search, save, contact (WhatsApp with a reference code), Notify me, and the owner `/dashboard` (needs-attention panel,
   enquiries, "Still available"). Also `/admin/operations` and `/manager/operations`.
2. **Watch the first few days.** Check Sentry and `docker logs rumia_backend` / `rumia_worker` on the server. The photo
   fingerprint backfill (`hash_legacy_media`) runs on the worker's 6-hourly freshness sweep.
3. **Supabase leftovers on the server.** Done 2026-10-11: `backend/.env.pre-cutover.bak` and `.env.pre-swap.bak` (old Supabase
   database credentials) were shredded. Still to decide: `backend/.env` has `SUPABASE_URL` and `web/.env.production` has
   `NEXT_PUBLIC_SUPABASE_URL` (the project URL only, not a secret). They were left because the backend still has a code path
   that reads `SUPABASE_URL`; remove them together with that code. Also tighten permissions: both files are `664`
   (group/other readable); `chmod 600` them (the deploy runs as the file owner).
4. **Sitemap.** Done: it revalidates hourly and now lists the area and landmark pages.

## Parked, with a known fix

5. **Mobile app (`nginx/mobile`).** Its CI job is paused (`if: false` in `.github/workflows/ci.yml`) and the folder is in
   `.gitignore` while still tracked. To bring it back: `cd nginx/mobile && pnpm run generate:api`, commit
   `lib/api/types.ts`, remove `if: false` and re-add `test-mobile` to the `needs` of `docker-build-test`. Decide whether to untrack it.
6. **WhatsApp alerts** are accepted but not sent until a messaging provider is connected. Email alerts work.
7. **Cosmetic log line.** Done: gunicorn now starts with `--no-control-socket`.
8. **Photo upload.** The browser still uses the original uploader. `/media/uploads` is built and tested but unused, and it
   needs an organisation, which a first-time agent does not have yet. Switch only when the listing form is redesigned.

## Decisions for you

9. **Opening up beyond DeKUT students.** The backend supports markets, places, landmarks, other property kinds and an
   audience per place. The frontend does not yet: the layout and home page load the `dekut` campus, listing links default to
   `nyeri` / `dekut`, and the copy says "students" and "hostels". Suggested order:
   1. Take the campus on the layout and home page from the visitor's market.
   2. Neutralise the copy and URL defaults.
   3. Add a second test market and run the whole site against it.
   4. Review the commission, consultation-fee and agent-contact rules for non-student rentals (a product decision).
   Also still DeKUT-specific in the backend: `DEFAULT_CAMPUS_SLUG` / `DEFAULT_COUNTY`, the "verified DeKUT students" review
   rule, the official-records table behind the verify checker, and managers mapped to the `nyeri` market.
10. **Drift monitoring.** Done: the worker runs the check five minutes after each start and then daily
    (`check_projection_drift` in `backend/app/core/tasks/cron.py`) and logs an ERROR, which Sentry turns into an event, when any
    listing disagrees with its property copy. The query lives in `backend/app/features/catalog/drift_check.sql`;
    `scripts/check-projection-drift.sql` is a symlink to it, so there is one definition. Make sure Sentry alerts on that message.
11. **The redesigned frontend** still lives on the branch `restructure/m1-live-fixes` (not merged). Keep it as a future option
    or delete it. `docs/restructure/` describes it.

## Reference

- Deploys: pushing to `main` deploys to production straight away (`.github/workflows/cd.yml`, no CI gate). Migrations are
  not part of the deploy: run them first with `scripts/migrate.sh` or `alembic upgrade head` against the production database.
- Backups: nightly dumps in `~/backups` on the server; two named dumps from before the migration
  (`rumia_prerestructure_…`, `rumia_premigrate_…`).
- The deploy script now clears Docker build cache when under 8 GB is free and prunes cache older than 3 days after each deploy.
- Local app: `scripts/local-dev/up.sh` / `down.sh` (untracked). `up.sh` is not re-runnable once the database is seeded.
