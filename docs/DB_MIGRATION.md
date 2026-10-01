# Supabase → self-hosted Postgres (Oracle) migration

Target: `rumia-instance2` (A1.Flex ARM, 2 OCPU / 12 GB). Postgres 17 (must match
Supabase; a pg17 dump will not load into 16). Auth stays on Supabase until step 3.

## Status
- [x] Step 1 prep: compose `postgres` service, `db/00_supabase_shim.sql`, replay script, backup script
- [x] Dry-run: live `public` schema dumped + restored to a scratch pg17; backend boots and serves feeds against it
- [x] Frontend has no database access (all via FastAPI); own Google auth implemented (backend `/auth/*`, web cookies, mobile SecureStore + one-time-code deep link)
- [x] Cutover done 2026-10-01: production runs on the self-hosted Postgres 17 + own Google auth (`AUTH_MODE=custom`)
- [x] Backups: nightly local dump (02:30, 7 days) + Cloudflare R2 (02:45, 14 days); restore-tested 2026-10-01 (all 38 tables identical)
- [ ] Supabase decommission (see "Decommission checklist" below)

## Known drift (live has it, migrations don't — restore from dump, don't replay)
`agent_messages` table, `agents.suspension_reason`, `listings.zone_id`; migrations create
`listing_verifications`, which live lacks. Reconcile in a follow-up migration.

## Cutover runbook (own Postgres + own Google auth, one maintenance window)
Everything below is scripted by `scripts/migrate-supabase-to-selfhosted.sh` (read-only against
Supabase; recreates database `rumia_new` on the VM each run and compares row counts of every table).

Rehearse first (no user impact): run the script, inspect the counts, repeat as needed.

Window (a few minutes):
1. `docker compose stop backend web` on the VM (stops writes).
2. Re-run the migration script (final copy, counts must match), then on the VM swap databases:
   `ALTER DATABASE rumia RENAME TO rumia_empty; ALTER DATABASE rumia_new RENAME TO rumia;`
   (connect to `postgres`; nothing else is connected while the apps are stopped).
3. Backend env (`backend/.env`): `DATABASE_URL=postgresql+asyncpg://rumia:<POSTGRES_PASSWORD>@postgres:5432/rumia`,
   `AUTH_MODE=custom`, `AUTH_JWT_SECRET=$(openssl rand -hex 32)`, `GOOGLE_CLIENT_ID/SECRET`,
   `GOOGLE_REDIRECT_URI=https://rumia.co.ke/auth/google/callback`, `ENVIRONMENT=production`.
4. Deploy the new code (`git push` -> CD, or `scripts/deploy.sh` on the VM).
5. Smoke test: `/api/v1/health`, listings feed, Google sign-in end to end, an agent dashboard, an admin page.
6. Rollback: set `DATABASE_URL` back to the Supabase pooler and `AUTH_MODE=supabase`, redeploy the
   previous commit. Writes made after cutover exist only in the new database, so keep the window short
   and decide quickly. The Supabase project is never modified by any step and must be kept until the
   new stack has run cleanly for a while.

Sessions: existing Supabase sessions are not carried over; everyone signs in with Google once.
Password sign-in no longer exists (all staff and managers have Gmail addresses).

## Current state (after cutover)
- Runtime no longer uses Supabase for data, login or storage (images are on R2).
- The Supabase project is untouched and frozen at the cutover time. It is the rollback target only;
  anything written since cutover exists only on the VM.
- Backups: `~/rumia-local-backup.sh` (cron 02:30, `~/backups`, 7 days) and `scripts/backup-db.sh`
  (cron 02:45 -> `s3://rumia-backup/postgres/`, 14 days) using `~/rumia/.backup.env` (server-only, gitignored).
- Server-only files NOT in the database dump and not in git: `backend/.env`, `web/.env.production`,
  `.env` (POSTGRES_PASSWORD), `.backup.env`. Keep a copy in a password manager.
- Old env backups from the cutover: `backend/.env.pre-cutover.bak`, `backend/.env.pre-swap.bak` (delete once
  no longer needed; they contain secrets). The empty pre-swap database is `rumia_empty` (safe to drop).

## Restore from backup
1. `aws s3 cp s3://rumia-backup/postgres/<file>.dump /tmp/r.dump --endpoint-url $R2_ENDPOINT` (creds from `.backup.env`).
2. `docker cp /tmp/r.dump rumia_postgres:/tmp/` then, into an empty database:
   `pg_restore -U rumia -d <db> --no-owner /tmp/r.dump`.
3. Compare row counts against the live DB (the `auth_refresh_tokens` table changes with sign-ins).
Tested 2026-10-01 into a throwaway database; counts identical.

## Rollback (while Supabase is still kept)
Set `DATABASE_URL` back to the Supabase pooler and `AUTH_MODE=supabase` in `backend/.env`, redeploy the
previous commit (web before the own-auth commits). Writes made after cutover are lost on rollback.

## Decommission checklist (do NOT delete the Supabase project before all are ticked)
- [ ] Sign in with Google as an agent, a manager and an admin; confirm dashboards, listing edit, approvals,
      announcements, tour bookings and an image upload work.
- [ ] Ship a mobile build that contains the own-auth flow (installed older builds still use Supabase login
      and will not work); run the mobile Google sign-in on a device (deep link `rumia://auth/callback`).
- [ ] New stack ran cleanly for ~2 weeks (check `docker compose logs backend`, Sentry, backup logs
      `~/backups/*.log`).
- [ ] A fresh R2 restore test after a week of production writes.
- [ ] Take a final full dump of Supabase (public + auth.users) and store it somewhere safe.
- [ ] Rotate credentials that were shared in chat (R2 access key/secret, Cloudflare API token, Google client
      secret if desired) and update `.backup.env` / `backend/.env`.
- [ ] Remove leftovers: `SUPABASE_*` from `backend/.env` and `web/.env.production`; the Supabase token
      verification and `SupabaseAuthProvider` fallback in `backend/app/core/{security,auth_provider}.py`;
      the `AUTH_MODE` switch (make custom the only mode); `db/00_supabase_shim.sql` rename to a plain
      `auth` schema bootstrap; `NEXT_PUBLIC_AUTH_REFRESH_PATH` and other stale env.
- [ ] Then pause and finally delete the Supabase project.

## Notes
- `pg_cron` is not installed; the nightly view-archive job falls back to the insert trigger
  (migrations guard this). Add a host cron calling `archive_listing_views()` if desired.
- Backups: `scripts/backup-db.sh` (needs R2 creds in `.backup.env`; restore-test once configured).
