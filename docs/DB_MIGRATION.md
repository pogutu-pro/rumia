# Supabase → self-hosted Postgres (Oracle) migration

Target: `rumia-instance2` (A1.Flex ARM, 2 OCPU / 12 GB). Postgres 17 (must match
Supabase; a pg17 dump will not load into 16). Auth stays on Supabase until step 3.

## Status
- [x] Step 1 prep: compose `postgres` service, `db/00_supabase_shim.sql`, replay script, backup script
- [x] Dry-run: live `public` schema dumped + restored to a scratch pg17; backend boots and serves feeds against it
- [x] Frontend has no database access (all via FastAPI); own Google auth implemented (backend `/auth/*`, web cookies, mobile SecureStore + one-time-code deep link)
- [ ] Cutover (below), then remove Supabase usage once the new stack is proven

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

## Notes
- `pg_cron` is not installed; the nightly view-archive job falls back to the insert trigger
  (migrations guard this). Add a host cron calling `archive_listing_views()` if desired.
- Backups: `scripts/backup-db.sh` (needs R2 creds in `.backup.env`; restore-test once configured).
