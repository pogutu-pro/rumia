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
- Applies the repo's legacy schema SQL (`db/00_legacy_shim.sql` +
  `db/legacy-migrations/*.sql`) and then Alembic `0001`–`0006`.
- Seeds six Nyeri hostels via `seed.sql`, then `project_listing()` copies them into
  the new `properties`/`property_units` model.
- Runs the backend on **:8000** with `backend/.env.development.local`
  (all `R2_*`/`BREVO_*` blank).
- Runs the web app on **:3000** with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`.

## No cloud services

This does **not** talk to any cloud service. The `db/legacy-migrations/*.sql` files are the legacy table definitions
checked into the repo; they are applied to the local Postgres. Every R2/Brevo/PostHog/Sentry credential is blanked in
the local env file, so nothing can reach production.
