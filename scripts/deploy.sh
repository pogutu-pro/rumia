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
# Stash any local changes (env edits etc.) so pull never fails
dirty=$(git status --porcelain)
if [ -n "$dirty" ]; then
  echo "  Stashing local changes..."
  git stash push -m "deploy-sh-auto-stash $(date +%s)"
  stashed=1
else
  stashed=0
fi

git pull origin main || git pull origin master

# Restore stashed changes (env files etc.)
if [ "$stashed" -eq 1 ]; then
  git stash pop || true
fi

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
