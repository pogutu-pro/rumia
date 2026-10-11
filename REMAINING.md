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
3. **Delete the old Supabase backups on the server.** `~/rumia/backend/.env.pre-cutover.bak` and `.env.pre-swap.bak` still hold
   the old Supabase connection details. Supabase is decommissioned, so remove them or rotate those credentials.
4. **Sitemap.** Fixed by the PR that adds this file (revalidates hourly). After it deploys, confirm
   `https://rumia.co.ke/sitemap.xml` lists `/areas/…` and `/near/…` entries.

## Parked, with a known fix

5. **Mobile app (`nginx/mobile`).** Its CI job is paused (`if: false` in `.github/workflows/ci.yml`) and the folder is in
   `.gitignore` while still tracked. To bring it back: `cd nginx/mobile && pnpm run generate:api`, commit
   `lib/api/types.ts`, remove `if: false` and re-add `test-mobile` to the `needs` of `docker-build-test`. Decide whether to untrack it.
6. **WhatsApp alerts** are accepted but not sent until a messaging provider is connected. Email alerts work.
7. **Cosmetic log line.** The backend logs one `Control server error: Permission denied: '/nonexistent'` at startup (gunicorn's
   control socket). The backend is healthy; silence it later.
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
10. **Drift monitoring.** `scripts/check-projection-drift.sql` lists any listing that disagrees with its copy in the property
    model. It is clean today but nothing runs it on a schedule. Run it after deploys, or add a daily job that alerts on any row.
11. **The redesigned frontend** still lives on the branch `restructure/m1-live-fixes` (not merged). Keep it as a future option
    or delete it. `docs/restructure/` describes it.

## Reference

- Deploys: pushing to `main` deploys to production straight away (`.github/workflows/cd.yml`, no CI gate). Migrations are
  not part of the deploy: run them first with `scripts/migrate.sh` or `alembic upgrade head` against the production database.
- Backups: nightly dumps in `~/backups` on the server; two named dumps from before the migration
  (`rumia_prerestructure_…`, `rumia_premigrate_…`).
- The deploy script now clears Docker build cache when under 8 GB is free and prunes cache older than 3 days after each deploy.
- Local app: `scripts/local-dev/up.sh` / `down.sh` (untracked). `up.sh` is not re-runnable once the database is seeded.
