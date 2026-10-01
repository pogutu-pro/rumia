#!/usr/bin/env bash
# Nightly Postgres backup -> Cloudflare R2 (S3 API). Run from cron on the VM:
#   15 2 * * * /opt/rumia/scripts/backup-db.sh >> /var/log/rumia-backup.log 2>&1
# Requires: docker, aws-cli. Env (e.g. /opt/rumia/.backup.env):
#   R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BACKUP_BUCKET
#   POSTGRES_USER POSTGRES_DB (defaults rumia)  RETENTION_DAYS (default 14)
set -euo pipefail
[ -f "$(dirname "$0")/../.backup.env" ] && . "$(dirname "$0")/../.backup.env"
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_BACKUP_BUCKET:?}"
DB="${POSTGRES_DB:-rumia}"; USER_="${POSTGRES_USER:-rumia}"; KEEP="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"; OUT="$(mktemp -d)/${DB}_${STAMP}.dump"
trap 'rm -rf "$(dirname "$OUT")"' EXIT

docker exec rumia_postgres pg_dump -U "$USER_" -d "$DB" -Fc --no-owner > "$OUT"
[ -s "$OUT" ] || { echo "empty dump" >&2; exit 1; }

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
EP="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
aws s3 cp "$OUT" "s3://${R2_BACKUP_BUCKET}/postgres/${DB}_${STAMP}.dump" --endpoint-url "$EP"

# prune dumps older than $KEEP days
CUT="$(date -u -d "-${KEEP} days" +%Y%m%d)"
aws s3 ls "s3://${R2_BACKUP_BUCKET}/postgres/" --endpoint-url "$EP" | awk '{print $4}' | while read -r k; do
  d="${k#${DB}_}"; d="${d:0:8}"
  [[ "$d" =~ ^[0-9]{8}$ && "$d" < "$CUT" ]] && aws s3 rm "s3://${R2_BACKUP_BUCKET}/postgres/$k" --endpoint-url "$EP"
done
echo "backup ok: ${DB}_${STAMP}.dump"
