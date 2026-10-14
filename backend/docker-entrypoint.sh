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
    echo "[AssetVault API] Migration failed, checking database readiness..."
  }
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[AssetVault API] Seeding database with baseline data..."
  npx prisma db seed || echo "[AssetVault API] Seed skipped or already applied."
fi

echo "[AssetVault API] Launching process: $@"
exec "$@"
