#!/usr/bin/env bash
# Stop the local Rumia dev stack started by scripts/local-dev/up.sh.
#   down.sh            stop the app servers and the Postgres container (data kept)
#   down.sh --purge    also remove the container and its data volume (full wipe)
#
# Only processes whose working directory is inside this repo are stopped, so other
# apps on ports 3000/8000 are left alone.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG=rumia_local_pg

stop_port() {
  local port=$1 pid cwd
  for pid in $(fuser "$port/tcp" 2>/dev/null); do
    cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
    case "$cwd" in
      "$ROOT"*) echo "   stopping pid $pid on :$port"; kill "$pid" 2>/dev/null || true ;;
      *) echo "   :$port held by unrelated pid $pid — leaving it" ;;
    esac
  done
}

# Restore the web env backed up by up.sh.
if [ -f /tmp/rumia-web-env.local.bak ]; then
  cp /tmp/rumia-web-env.local.bak "$ROOT/web/.env.local"
  echo "==> Restored web/.env.local"
fi

echo "==> Stopping app servers"
stop_port 8000
stop_port 3000

echo "==> Stopping Postgres container"
docker stop "$PG" >/dev/null 2>&1 || true

if [ "${1:-}" = "--purge" ]; then
  echo "==> Removing container and volume"
  docker rm "$PG" >/dev/null 2>&1 || true
  docker volume rm rumia_local_pgdata >/dev/null 2>&1 || true
  echo "   purged"
fi
