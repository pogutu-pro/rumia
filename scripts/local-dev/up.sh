#!/usr/bin/env bash
# Local end-to-end dev stack for Rumia — everything runs on this machine:
#   * a throwaway Postgres container (named rumia_local_pg, port 55436)
#   * the FastAPI backend on :8000, with AUTH_MODE=custom and blank cloud creds
#   * the Next.js web app on :3000
#
# NO Supabase / cloud service is contacted. The `supabase/migrations/*.sql` files
# are only legacy schema SQL that Alembic 0002+ build on; they are applied to the
# local Postgres, not to Supabase.
#
# Reversible: run scripts/local-dev/down.sh (keeps data) or down.sh --purge (wipes it).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG=rumia_local_pg
PORT=55436
DB="postgresql://rumia:rumia@127.0.0.1:${PORT}/rumia_local"
ASYNC_DB="postgresql+asyncpg://rumia:rumia@127.0.0.1:${PORT}/rumia_local"

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

echo "==> Postgres ($PG on :$PORT)"
if ! docker inspect "$PG" >/dev/null 2>&1; then
  docker run -d --name "$PG" \
    -e POSTGRES_DB=rumia_local -e POSTGRES_USER=rumia -e POSTGRES_PASSWORD=rumia \
    -p "127.0.0.1:${PORT}:5432" -v rumia_local_pgdata:/var/lib/postgresql/data \
    postgres:17-alpine >/dev/null
else
  docker start "$PG" >/dev/null 2>&1 || true
fi
until docker exec "$PG" pg_isready -U rumia -d rumia_local >/dev/null 2>&1; do sleep 1; done

echo "==> Schema"
if ! docker exec "$PG" psql -U rumia -d rumia_local -tAc \
     "select 1 from information_schema.tables where table_name='listings'" | grep -q 1; then
  echo "   applying legacy schema SQL (repo files, not Supabase the service)…"
  DATABASE_URL="$DB" bash "$ROOT/scripts/db-replay-migrations.sh"
fi
(cd "$ROOT/backend" && DATABASE_URL="$ASYNC_DB" uv run alembic upgrade head)

echo "==> Seed"
PGPASSWORD=rumia psql -h 127.0.0.1 -p "$PORT" -U rumia -d rumia_local -q -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/local-dev/seed.sql" >/dev/null

echo "==> Backend env"
if [ ! -f "$ROOT/backend/.env.development.local" ]; then
  cat > "$ROOT/backend/.env.development.local" <<'ENV'
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://rumia:rumia@127.0.0.1:55436/rumia_local
AUTH_MODE=custom
AUTH_JWT_SECRET=local-dev-only-auth-secret-0123456789abcdef
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
BREVO_WEBHOOK_SECRET=
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=
SENTRY_DSN=
EXPO_PUSH_ACCESS_TOKEN=
PUBLIC_BASE_URL=http://localhost:8000
RATE_LIMIT_ENABLED=false
RUN_SCHEDULER=false
ENV
fi

echo "==> Backend (:8000)"
if port_open 8000; then echo "   already running"; else
  (cd "$ROOT/backend" && setsid -f .venv/bin/uvicorn app.main:app \
     --env-file .env.development.local --port 8000 \
     >/tmp/rumia-local-backend.log 2>&1 </dev/null)
fi

echo "==> Web env → local API (:3000)"
if [ -f "$ROOT/web/.env.local" ] && ! grep -q 'NEXT_PUBLIC_API_BASE_URL=http://localhost:8000' "$ROOT/web/.env.local"; then
  cp "$ROOT/web/.env.local" /tmp/rumia-web-env.local.bak
  sed -i 's|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1|; s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=http://localhost:3000|' "$ROOT/web/.env.local"
fi

echo "==> Web (:3000)"
if port_open 3000; then echo "   already running"; else
  (cd "$ROOT/web" && setsid -f pnpm exec next dev --webpack -p 3000 \
     >/tmp/rumia-local-web.log 2>&1 </dev/null)
fi

cat <<EOF

Local stack is up (first web request compiles, give it ~15s):
  Explore   http://localhost:3000/
  Property  http://localhost:3000/p/sunrise-hostel
  API docs  http://localhost:8000/docs

Logs: /tmp/rumia-local-backend.log  /tmp/rumia-local-web.log
Stop: scripts/local-dev/down.sh          (keeps the database)
Wipe: scripts/local-dev/down.sh --purge  (removes container + volume)
EOF
