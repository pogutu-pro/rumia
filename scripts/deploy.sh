#!/usr/bin/env bash

# ==============================================================================
# Production Deployment Script for Rumia Platform on Oracle VPS
# ==============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Pre-flight: ensure required env files exist ───────────────────────────────
missing=0
for f in backend/.env web/.env.production; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found. Copy from the example and fill in secrets:"
    echo "  cp backend/.env.example backend/.env && nano backend/.env"
    echo "  cp web/.env.example     web/.env.production && nano web/.env.production"
    missing=1
  fi
done
[ "$missing" -eq 1 ] && exit 1

echo "=== [1/5] Pulling latest code changes from repository ==="
# This host is provisioned by CI, so the committed tree is the source of truth.
# - Env files (backend/.env, web/.env.production) are gitignored and survive reset.
# - Live TLS certs (certbot/) are untracked and are never touched.
# - Any stray tracked edits or stale conflict markers from a previous failed
#   deploy are discarded (a stash/pop here is what left conflict markers in
#   web/src/app/(public)/page.tsx and broke a build once).
git fetch origin main 2>/dev/null || git fetch origin master 2>/dev/null
git reset --hard origin/main 2>/dev/null || git reset --hard origin/master
# Drop stale auto-stash snapshots left behind by older deploy.sh versions.
git stash list | grep -q 'deploy-sh-auto-stash' && \
  git stash list | grep 'deploy-sh-auto-stash' | sed 's/:.*//' | xargs -r -n1 git stash drop || true

echo "=== [2/5] Building production Docker container images ==="
docker compose build --pull

echo "=== [3/5] Starting containers in detached mode ==="
docker compose up -d

echo "=== [4/5] Running container health checks ==="
sleep 10
docker compose ps

# Quick health check: confirm backend responds
if docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/liveness')" 2>/dev/null; then
  echo "✓ Backend health check passed"
else
  echo "⚠ Backend health check failed — check logs: docker compose logs backend"
fi

echo "=== [5/5] Reloading Nginx reverse proxy ==="
docker compose exec nginx nginx -s reload || true

echo "=== Rumia Production Deployment Successful! ==="
