#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../environment.sh"

PROJECT_ROOT="$(mktemp -d)"
trap 'rm -rf "$PROJECT_ROOT"' EXIT
mkdir -p "${PROJECT_ROOT}/backend"

printf '%s\n' 'DATABASE_DIRECT_URL="postgresql://direct-user:direct-pass@db.example.test:5432/app?schema=public"' > "${PROJECT_ROOT}/.env"
printf '%s\n' 'DIRECT_URL=postgresql://backend-user:backend-pass@db.example.test:5432/app' > "${PROJECT_ROOT}/backend/.env"

unset DATABASE_DIRECT_URL DIRECT_URL
export DATABASE_URL="postgresql://runtime-user:runtime-pass@db.example.test:5432/app"

load_project_env "$PROJECT_ROOT"

[[ "$DATABASE_URL" == "postgresql://runtime-user:runtime-pass@db.example.test:5432/app" ]]
[[ "$DATABASE_DIRECT_URL" == "postgresql://direct-user:direct-pass@db.example.test:5432/app?schema=public" ]]
[[ "$DIRECT_URL" == "postgresql://backend-user:backend-pass@db.example.test:5432/app" ]]

export DATABASE_DIRECT_URL="postgresql://explicit-user:explicit-pass@db.example.test:5432/app"
load_project_env "$PROJECT_ROOT"
[[ "$DATABASE_DIRECT_URL" == "postgresql://explicit-user:explicit-pass@db.example.test:5432/app" ]]

echo "[PASS] Backup environment loading preserves exported values and loads the privileged URL."
