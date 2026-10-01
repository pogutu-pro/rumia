#!/usr/bin/env bash
# Replay db/00_supabase_shim.sql then supabase/migrations/*.sql on a Postgres.
# Usage: DATABASE_URL=postgresql://user:pass@host:port/db scripts/db-replay-migrations.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL (psycopg/libpq style, no +asyncpg)}"
cd "$(dirname "$0")/.."
psql() { command psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
psql -f db/00_supabase_shim.sql
for f in $(ls supabase/migrations/*.sql | sort); do
  echo ">> $(basename "$f")"
  psql -f "$f" >/dev/null
done
echo "replayed $(ls supabase/migrations/*.sql | wc -l) migrations"
