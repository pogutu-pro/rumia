#!/usr/bin/env bash
# Copy the live Supabase database (public schema + auth.users identities) into the self-hosted
# Postgres container on the VM. READ-ONLY against Supabase. Safe to re-run: the target database
# is dropped and recreated each time, so run it as a rehearsal before the real cutover.
#
#   SUPABASE_DB_URL=postgresql://postgres.<ref>:<pw>@aws-0-...pooler.supabase.com:5432/postgres \
#   VM=ubuntu@84.12.71.24 SSH_KEY=ssh-key-2026-09-04.key scripts/migrate-supabase-to-selfhosted.sh
#
# Use the session pooler (port 5432) so pg_dump works. Prints row counts for every table in both
# databases and exits non-zero if any differ.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_DB_URL:?}" "${VM:?}" "${SSH_KEY:?}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$VM")
SCP=(scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)
REMOTE='cd ~/rumia && docker compose exec -T postgres'
PSQL="$REMOTE psql -U rumia -v ON_ERROR_STOP=1 -q"

echo "[1/6] dump public schema from Supabase"
# pg_dump must be >= the server major version (17); use the matching client image.
for attempt in 1 2 3 4 5 6; do  # the pooler occasionally drops long COPYs
  docker run --rm --network host -v "$WORK:$WORK" postgres:17-alpine pg_dump "$SUPABASE_DB_URL" --exclude-table-data=public.listing_views -Fc --no-owner --no-privileges --schema=public -f "$WORK/rumia.dump" && break
  echo "dump attempt $attempt failed, retrying" >&2; sleep 10
done
[ -s "$WORK/rumia.dump" ] || { echo "dump failed" >&2; exit 1; }
echo "[2/6] export auth.users identities + listing_views"
# The pooler drops long reads of this table (2 min statement_timeout, connection resets), so it is
# copied in keyset-paginated chunks, each in its own short session.
: > "$WORK/listing_views.csv"; LAST="00000000-0000-0000-0000-000000000000"
while :; do
  rm -f "$WORK/lv_chunk.csv"
  for attempt in 1 2 3 4 5 6; do
    psql "$SUPABASE_DB_URL" -q -c "\\copy (select * from public.listing_views where id > '$LAST' order by id limit 4000) to '$WORK/lv_chunk.csv' csv" && break
    echo "listing_views chunk after $LAST failed (attempt $attempt), retrying" >&2; sleep 10
  done
  [ -f "$WORK/lv_chunk.csv" ] || { echo "listing_views export failed" >&2; exit 1; }
  [ -s "$WORK/lv_chunk.csv" ] || break
  cat "$WORK/lv_chunk.csv" >> "$WORK/listing_views.csv"
  LAST="$(tail -n 1 "$WORK/lv_chunk.csv" | cut -d, -f1)"
done
[ -s "$WORK/listing_views.csv" ] || { echo "listing_views export failed" >&2; exit 1; }
psql "$SUPABASE_DB_URL" -qc "\copy (select id,email,phone,raw_user_meta_data,raw_app_meta_data,created_at,coalesce(updated_at,created_at),last_sign_in_at from auth.users) to '$WORK/users.csv' csv"
psql "$SUPABASE_DB_URL" -Atc "select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1" > "$WORK/counts_src.txt"
psql "$SUPABASE_DB_URL" -Atc "select 'auth.users', count(*) from auth.users" >> "$WORK/counts_src.txt"

echo "[3/6] ship to VM"
"${SCP[@]}" "$WORK/rumia.dump" "$WORK/users.csv" "$WORK/listing_views.csv" db/00_supabase_shim.sql supabase/migrations/20261001000000_auth_refresh_tokens.sql "$VM:/tmp/"

echo "[4/6] recreate target database + shim + identities"
"${SSH[@]}" "$REMOTE psql -U rumia -d postgres -qc 'DROP DATABASE IF EXISTS rumia_new' -c 'CREATE DATABASE rumia_new'"
"${SSH[@]}" "cd ~/rumia && docker cp /tmp/rumia.dump rumia_postgres:/tmp/ && docker cp /tmp/users.csv rumia_postgres:/tmp/ && docker cp /tmp/listing_views.csv rumia_postgres:/tmp/ && docker cp /tmp/00_supabase_shim.sql rumia_postgres:/tmp/ && docker cp /tmp/20261001000000_auth_refresh_tokens.sql rumia_postgres:/tmp/"
"${SSH[@]}" "$PSQL -d rumia_new -f /tmp/00_supabase_shim.sql"
"${SSH[@]}" "$PSQL -d rumia_new -c \"\\copy auth.users(id,email,phone,raw_user_meta_data,raw_app_meta_data,created_at,updated_at,last_sign_in_at) from '/tmp/users.csv' csv\""

echo "[5/6] restore"
"${SSH[@]}" "cd ~/rumia && docker compose exec -T postgres sh -c \"pg_restore -l /tmp/rumia.dump | grep -v ' SCHEMA - public ' > /tmp/restore.list && pg_restore -U rumia -d rumia_new --no-owner --exit-on-error -L /tmp/restore.list /tmp/rumia.dump\""
"${SSH[@]}" "$PSQL -d rumia_new -f /tmp/20261001000000_auth_refresh_tokens.sql"
"${SSH[@]}" "$PSQL -d rumia_new -c \"\\copy public.listing_views from '/tmp/listing_views.csv' csv\""

echo "[6/6] verify row counts"
"${SSH[@]}" "$PSQL -d rumia_new -At -c \"select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1\" -c \"select 'auth.users', count(*) from auth.users\"" > "$WORK/counts_dst.txt"
sed -i 's/|/ /' "$WORK/counts_src.txt" "$WORK/counts_dst.txt" 2>/dev/null || true
grep -v '^auth_refresh_tokens ' "$WORK/counts_dst.txt" > "$WORK/dst_cmp.txt"
if diff <(sort "$WORK/counts_src.txt") <(sort "$WORK/dst_cmp.txt"); then
  echo "OK: all $(wc -l < "$WORK/counts_src.txt") table counts match -> database 'rumia_new' on the VM is ready to be swapped in"
else
  echo "MISMATCH between Supabase (<) and VM (>) counts" >&2; exit 1
fi
