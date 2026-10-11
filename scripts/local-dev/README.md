# Local end-to-end development

Run the whole product on this machine — no cloud, no production.

```bash
scripts/local-dev/up.sh      # first run takes a few minutes (schema), then seconds
# open http://localhost:3000
scripts/local-dev/down.sh    # stop servers + Postgres (data kept)
scripts/local-dev/down.sh --purge   # stop and delete the database
```

## What it does

- A throwaway **Postgres 17 container** `rumia_local_pg` on `127.0.0.1:55436`
  (data in the named volume `rumia_local_pgdata`).
- Applies the repo's legacy schema SQL (`db/00_supabase_shim.sql` +
  `supabase/migrations/*.sql`) and then Alembic `0001`–`0006`.
- Seeds six Nyeri hostels via `seed.sql`, then `project_listing()` copies them into
  the new `properties`/`property_units` model.
- Runs the backend on **:8000** with `backend/.env.development.local`
  (`AUTH_MODE=custom`, all `SUPABASE_*`/`R2_*`/`BREVO_*` blank).
- Runs the web app on **:3000** with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`.

## No Supabase

This does **not** talk to Supabase (or any cloud service). The `supabase/migrations/*.sql`
files are just the legacy table definitions checked into the repo; they are applied to the
local Postgres. Auth runs in `custom` mode, and every Supabase/R2/Brevo/PostHog/Sentry
credential is blanked in the local env file, so nothing can reach production.

> Note: the plan (`docs/restructure/HANDOFF.md`) records "Alembic baseline from the live
> schema (needs a production `pg_dump --schema-only`)" as an outstanding item. Until that
> lands, the local schema is built from the checked-in SQL above.

## Reversibility

- `down.sh` restores `web/.env.local` from the backup it made and stops only processes
  whose working directory is inside this repo.
- `down.sh --purge` removes the container and its volume — nothing outside `/tmp` and the
  named Docker volume is touched.
- Backend local config lives in the git-ignored `backend/.env.development.local`; delete it
  to reset.

## Seed data

`seed.sql` is idempotent: it deletes the agents it created (phone `+2547120000xx`) and their
listings, then re-inserts. Edit it to add more places, or point the app at a real database
by setting `DATABASE_URL` yourself.
