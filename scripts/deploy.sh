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

# Prevent concurrent deployment races if manual SSH and GitHub Actions run simultaneously
exec 200>/tmp/rumia_deploy.lock
flock -x 200

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

# Every build leaves cache behind and nothing ever removed it: it reached 36 GB and filled the disk to 95%.
# If space is already tight, clear the cache first so the build itself cannot run out of disk.
free_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
if [ "${free_gb:-0}" -lt 8 ]; then
  echo "Only ${free_gb}G free; clearing the Docker build cache before building"
  docker builder prune -a -f || true
fi

echo "=== [2/5] Building production Docker container images ==="
docker compose build --pull

echo "=== [3/5] Starting containers in detached mode ==="
docker compose up -d --remove-orphans

echo "=== [4/5] Running container health checks ==="
sleep 10
docker compose ps

# Quick health check: confirm backend responds
if docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health/liveness')" 2>/dev/null; then
  echo "✓ Backend health check passed"
else
  echo "⚠ Backend health check failed — check logs: docker compose logs backend"
fi

echo "=== [5/5] Restarting Nginx reverse proxy ==="
# Must RESTART (not just `nginx -s reload`): nginx.conf is a file-style bind
# mount, and `git reset --hard` replaces the file with a new inode, so the
# running container keeps pointing at the old inode and a reload re-reads
# stale config. Restarting re-establishes the mount against the current file.
docker compose restart nginx

# Keep the last few days of build cache (so the next deploy is fast) and drop untagged leftovers.
# Never fatal: a failed cleanup must not fail a deploy that already succeeded.
docker builder prune -f --filter "until=72h" >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true

echo "=== Rumia Production Deployment Successful! ==="
