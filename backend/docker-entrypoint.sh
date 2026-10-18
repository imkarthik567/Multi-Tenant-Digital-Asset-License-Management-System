#!/bin/sh
set -e

# ==============================================================================
# AssetVault: API Docker Container Entrypoint
# Runs database migrations and executes runtime process as non-root user
# ==============================================================================

echo "[AssetVault API] Starting container initialization..."

if [ "${NODE_ENV:-production}" = "production" ]; then
  if [ -z "${DIRECT_URL:-}" ]; then
    echo "[AssetVault API] FATAL: DIRECT_URL is required for production migrations and role bootstrap."
    exit 1
  fi
  if [ -z "${APP_DB_PASSWORD:-}" ] || [ "${#APP_DB_PASSWORD}" -lt 32 ]; then
    echo "[AssetVault API] FATAL: APP_DB_PASSWORD must be set to a unique value of at least 32 characters."
    exit 1
  fi
fi

if [ -n "$DATABASE_URL" ]; then
  echo "[AssetVault API] Applying production database migrations..."
  npx prisma migrate deploy || {
    echo "[AssetVault API] FATAL: Database migration failed! Exiting container."
    exit 1
  }
fi

if [ "${NODE_ENV:-production}" = "production" ]; then
  echo "[AssetVault API] Configuring restricted assetvault_app runtime role..."
  psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -v APP_PASSWORD="$APP_DB_PASSWORD" \
    -f /app/database/sql/08_production_bootstrap.sql || {
      echo "[AssetVault API] FATAL: Restricted runtime-role bootstrap failed."
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
