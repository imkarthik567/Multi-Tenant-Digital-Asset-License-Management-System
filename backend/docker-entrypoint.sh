#!/bin/sh
set -e

# ==============================================================================
# AssetVault: API Docker Container Entrypoint
# Runs database migrations and executes runtime process as non-root user
# ==============================================================================

echo "[AssetVault API] Starting container initialization..."

if [ -n "$DATABASE_URL" ]; then
  echo "[AssetVault API] Applying production database migrations..."
  npx prisma migrate deploy || {
    echo "[AssetVault API] FATAL: Database migration failed! Exiting container."
    exit 1
  }
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[AssetVault API] Seeding baseline roles, plans, license types, and initial administrator..."
  if [ ! -f "./dist-seed/prisma/seed.js" ]; then
    echo "[AssetVault API] FATAL: Compiled production seed script is missing."
    exit 1
  fi
  node ./dist-seed/prisma/seed.js || {
    echo "[AssetVault API] FATAL: Database seed failed. Exiting container."
    exit 1
  }
fi

echo "[AssetVault API] Launching process: $@"
exec "$@"
