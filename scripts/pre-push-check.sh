#!/usr/bin/env bash

# ==============================================================================
# Local Pre-Push Verification Script for Developers
# Run this before git push to verify backend tests & frontend typecheck pass.
# ==============================================================================

set -e

echo "=== [1/3] Running Backend Pytest Suite ==="
cd backend
if [ -d ".venv" ]; then
  .venv/bin/pytest tests/ -q
else
  uv run pytest tests/ -q
fi
cd ..
echo "✓ Backend tests passed!"

echo "=== [2/3] Running Frontend TypeScript Typecheck ==="
cd web
npx tsc --noEmit
cd ..
echo "✓ Frontend typecheck passed!"

echo "=== [3/3] Validating Docker Compose Build Syntax (optional) ==="
if command -v docker &> /dev/null; then
  docker compose config > /dev/null
  echo "✓ Docker Compose configuration valid!"
else
  echo "⚠  Docker not found locally — skipping compose check (CI will verify on push)."
fi

echo ""
echo "======================================================================"
echo "🎉 ALL LOCAL CHECKS PASSED! Safe to commit and push code."
echo "======================================================================"
