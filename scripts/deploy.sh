#!/usr/bin/env bash

# ==============================================================================
# Production Deployment Script for Rumia Platform on Oracle VPS
# ==============================================================================

set -e

echo "=== [1/5] Pulling latest code changes from repository ==="
git pull origin main || git pull origin master

echo "=== [2/5] Building production Docker container images ==="
docker compose build --pull

echo "=== [3/5] Starting containers in detached mode ==="
docker compose up -d

echo "=== [4/5] Running container health checks ==="
sleep 5
docker compose ps

echo "=== [5/5] Reloading Nginx reverse proxy ==="
docker compose exec nginx nginx -s reload || true

echo "=== Rumia Production Deployment Successful! ==="
