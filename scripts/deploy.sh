#!/bin/bash
# Phase 6: Oracle VPS Deployment Script

set -e

echo "🚀 Starting Rumia Production Deployment on Oracle VPS..."

# 1. Pull latest code
echo "📦 Pulling latest changes from Git..."
git pull origin main

# 2. Rebuild images securely
echo "🏗️ Building Docker images..."
docker-compose build

# 3. Bring up containers with minimal downtime
echo "🔄 Restarting services..."
docker-compose up -d --remove-orphans

# 4. Clean up unused images
echo "🧹 Pruning old Docker images to save VPS disk space..."
docker image prune -f

echo "✅ Deployment successful. Application running on ports 80/443."
