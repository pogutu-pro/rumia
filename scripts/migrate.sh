#!/usr/bin/env bash
# Apply schema migrations. Usage:
#   scripts/migrate.sh upgrade      # apply everything up to head
#   scripts/migrate.sh stamp-baseline   # one time, on a database that already has the legacy schema
#   scripts/migrate.sh current
# Runs inside the backend container when available, else locally with uv.
set -euo pipefail
cd "$(dirname "$0")/.."
cmd="${1:-upgrade}"
case "$cmd" in
  upgrade)        args=(upgrade head) ;;
  stamp-baseline) args=(stamp 0001) ;;
  current)        args=(current) ;;
  *) echo "usage: $0 upgrade|stamp-baseline|current" >&2; exit 2 ;;
esac
if docker compose ps --status running backend >/dev/null 2>&1 && [ -n "$(docker compose ps -q backend 2>/dev/null)" ]; then
  docker compose exec -T backend alembic "${args[@]}"
else
  (cd backend && uv run alembic "${args[@]}")
fi
