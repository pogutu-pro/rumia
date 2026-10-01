# Supabase → self-hosted Postgres (Oracle) migration

Target: `rumia-instance2` (A1.Flex ARM, 2 OCPU / 12 GB). Postgres 17 (must match
Supabase; a pg17 dump will not load into 16). Auth stays on Supabase until step 3.

## Status
- [x] Step 1 prep: compose `postgres` service, `db/00_supabase_shim.sql`, replay script, backup script
- [x] Dry-run: live `public` schema dumped + restored to a scratch pg17; backend boots and serves feeds against it
- [ ] Cutover (below), then step 2 (frontend direct DB calls -> FastAPI), step 3 (custom Google auth), step 4 (remove Supabase)

## Known drift (live has it, migrations don't — restore from dump, don't replay)
`agent_messages` table, `agents.suspension_reason`, `listings.zone_id`; migrations create
`listing_verifications`, which live lacks. Reconcile in a follow-up migration.

## Cutover runbook (short maintenance window)
1. On the VM: add `POSTGRES_PASSWORD` (+ optional `POSTGRES_USER`/`POSTGRES_DB`) to the compose env, then
   `docker compose up -d postgres` and wait for healthy.
2. Create the shim: `psql ... -f db/00_supabase_shim.sql` (roles, `auth.users`, `auth.uid()`).
3. Stop writes: `docker compose stop backend web`.
4. Dump live (session pooler, port 5432):
   `pg_dump -h aws-0-eu-west-1.pooler.supabase.com -p 5432 -U postgres.<ref> -d postgres -Fc --no-owner --no-privileges --schema=public -f rumia.dump`
5. Copy ids/emails for FK targets:
   `\copy (select id,email,phone,raw_user_meta_data,raw_app_meta_data,created_at from auth.users) to users.csv csv`
   then load into the local `auth.users` BEFORE restoring (so `auth.users(id)` foreign keys hold).
6. Restore: `pg_restore -d rumia --no-owner rumia.dump`; verify row counts vs Supabase.
7. Point `backend/.env` `DATABASE_URL=postgresql+asyncpg://rumia:<pw>@postgres:5432/rumia`.
   Keep `SUPABASE_URL`/keys (auth still Supabase).
8. `docker compose up -d backend web`; smoke test `/api/v1/listings`, `/campuses`, a login.
9. Rollback: restore the old `DATABASE_URL` and restart; Supabase data is untouched until step 4.

## Notes
- `pg_cron` is not installed; the nightly view-archive job falls back to the insert trigger
  (migrations guard this). Add a host cron calling `archive_listing_views()` if desired.
- The web app still talks to Supabase directly (~86 call sites) — those keep hitting Supabase
  until step 2, so **writes via the web app will diverge from the new DB**. Do step 2 before
  or together with cutover, or cut over only after the web's direct calls are moved.
- Backups: `scripts/backup-db.sh` (needs R2 creds in `.backup.env`; restore-test once configured).
