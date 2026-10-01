#!/usr/bin/env bash
# Spin up a throwaway Postgres 17 and restore a production pg_dump into it, for
# real-data smoke tests and parity checks. Never touches production.
# Usage: scripts/restore-snapshot.sh /path/to/rumia.dump
#   -> postgresql://postgres:pw@localhost:5555/rumia_restore
set -euo pipefail
DUMP="${1:?path to pg_dump -Fc file}"
cd "$(dirname "$0")/.."
NAME=rumia-scratch-pg17
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=pw -p 5555:5432 postgres:17-alpine >/dev/null
export PGPASSWORD=pw
P="psql -h localhost -p 5555 -U postgres -q -v ON_ERROR_STOP=1"
for _ in $(seq 1 30); do $P -c "select 1" postgres >/dev/null 2>&1 && break; sleep 1; done
$P -c "create database rumia_restore" postgres
$P -d rumia_restore -f db/00_supabase_shim.sql
docker cp "$DUMP" "$NAME":/tmp/rumia.dump
RESTORE="docker exec -e PGPASSWORD=pw $NAME pg_restore -U postgres -d rumia_restore --no-owner"
$RESTORE --disable-triggers /tmp/rumia.dump >/dev/null 2>&1 || true   # FK-to-auth.users errors expected here
$P -d rumia_restore -c "insert into auth.users(id,email) select id,email from profiles on conflict do nothing"
$RESTORE -s --section=post-data /tmp/rumia.dump >/dev/null 2>&1 || true  # re-apply FKs now auth.users is seeded
echo "ready: postgresql://postgres:pw@localhost:5555/rumia_restore"
