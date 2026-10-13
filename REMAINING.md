# What is left

Status as of 2026-10-13. The classic UI on the new backend (PR #6) and the open-markets work (PR #11) are merged and deployed.
Production is on database revision `0007` with zero drift. **Migrations `0008` (email sign-in codes) and `0009` (password
credentials) are in `main` but NOT applied to production yet: apply them (backup, rehearsal on a restored copy) or the email sign-in
endpoints will fail.**

Details of what shipped: `docs/restructure/CLASSIC_UI.md`.

## Do soon

1. **Check it on a phone.** Nothing has been viewed in a browser, only exercised over HTTP. Open https://rumia.co.ke and try
   search, save, contact (WhatsApp with a reference code), Notify me, and the owner `/dashboard` (needs-attention panel,
   enquiries, "Still available"). Also `/admin/operations` and `/manager/operations`.
2. **Watch the first few days.** Check Sentry and `docker logs rumia_backend` / `rumia_worker` on the server. The photo
   fingerprint backfill (`hash_legacy_media`) runs on the worker's 6-hourly freshness sweep.
3. **Supabase.** Done 2026-10-13 (PR #13): the token path, settings, SDK packages, scripts and the `supabase/` folder are gone, the legacy
   SQL lives in `db/legacy-migrations`, and the server env files hold no Supabase lines (mode `600`).
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

9. **Opening up beyond DeKUT students.** Done and live (PR #11, migration `0007`): SEO pages by market, type and place
   (`/nyeri`, `/nyeri/apartments`, `/nyeri/bedsitters/boma`); every listing at `/{market}/{type}/{place}/{name}` with 308 redirects
   from `/hostels/...`, `/bnb/{id}`, `/areas/...`; search cards carry their exact `path`; no `nyeri`/`dekut` literals in URL
   building (a listing without county or area uses `/p/{slug}`); the default campus is the first active campus in the data;
   `DEFAULT_COUNTY` / `DEFAULT_CAMPUS_SLUG` removed; a new listing takes its market from the agent's campus city; managers get the
   market of the campus they manage; King'ong'o listings now have their place. Still open:
   1. Run the whole site against a second test market locally (nothing has been run against more than Nyeri).
   2. Short stays: none exist in production or locally, so `/nyeri/short-stays/...` pages and the `/bnb/{id}` redirect are untested.
   3. The `/verify` official-records feature is DeKUT-only data (93 rows). Keep or remove: a product decision.
   4. Commission, consultation-fee and agent-contact rules for non-student rentals: a product decision.
   5. Wording that still says "students" / "DeKUT": the `/hostels` page title, the OG image, hostel listing titles ("Near DeKUT").
   6. Google Search Console: submit `https://rumia.co.ke/sitemap.xml`, run the Rich Results Test on `/nyeri` and a listing, and watch for a
      temporary ranking dip while the old URLs redirect.
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
