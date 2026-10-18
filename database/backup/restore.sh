#!/usr/bin/env bash
# ==============================================================================
# AssetVault: Native PostgreSQL Database Restore Script (Bash / Linux / macOS)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Native tools: pg_restore (--clean --if-exists --no-owner) + Checksum Verification
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"

DUMP_FILE=""
SCRATCH_MODE=false
TARGET_DB=""
YES_MODE=false
DOCKER_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scratch)
      SCRATCH_MODE=true
      shift
      ;;
    --target-db)
      TARGET_DB="$2"
      shift 2
      ;;
    -y|--yes|--force)
      YES_MODE=true
      shift
      ;;
    --docker)
      DOCKER_MODE=true
      shift
      ;;
    *)
      if [[ -z "${DUMP_FILE}" ]]; then
        DUMP_FILE="$1"
      fi
      shift
      ;;
  esac
done

# 1. Resolve Dump File
if [[ -z "${DUMP_FILE}" ]]; then
  LATEST="$(ls -t "${BACKUP_DIR}"/assetvault_*.dump 2>/dev/null | head -n 1 || true)"
  if [[ -z "${LATEST}" ]]; then
    echo "[ERROR] No backup file specified and no .dump files found in ${BACKUP_DIR}"
    exit 1
  fi
  DUMP_FILE="${LATEST}"
  echo "[INFO] No file specified. Auto-selected latest backup: $(basename "${DUMP_FILE}")"
else
  if [[ ! -f "${DUMP_FILE}" ]]; then
    if [[ -f "${BACKUP_DIR}/${DUMP_FILE}" ]]; then
      DUMP_FILE="${BACKUP_DIR}/${DUMP_FILE}"
    else
      echo "[ERROR] Backup file does not exist: ${DUMP_FILE}"
      exit 1
    fi
  fi
fi

# 2. Checksum Verification
DUMP_DIR="$(dirname "${DUMP_FILE}")"
DUMP_NAME="$(basename "${DUMP_FILE}")"
CHECKSUM_FILE="${DUMP_DIR}/${DUMP_NAME}.sha256"

if [[ -f "${CHECKSUM_FILE}" ]]; then
  echo "[1/3] Verifying SHA-256 cryptographic checksum..."
  EXPECTED_HASH="$(awk '{print $1}' "${CHECKSUM_FILE}" | tr '[:upper:]' '[:lower:]')"
  if command -v sha256sum &> /dev/null; then
    ACTUAL_HASH="$(sha256sum "${DUMP_FILE}" | awk '{print $1}' | tr '[:upper:]' '[:lower:]')"
  elif command -v shasum &> /dev/null; then
    ACTUAL_HASH="$(shasum -a 256 "${DUMP_FILE}" | awk '{print $1}' | tr '[:upper:]' '[:lower:]')"
  else
    echo "[ERROR] Neither sha256sum nor shasum is installed; refusing to restore without checking the archive checksum."
    exit 1
  fi

  if [[ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]]; then
    echo "[ERROR] Checksum mismatch! Integrity verification failed."
    echo "  Expected: ${EXPECTED_HASH}"
    echo "  Actual  : ${ACTUAL_HASH}"
    exit 1
  fi
  echo "[PASS] Checksum verified: ${ACTUAL_HASH}"
else
  echo "[ERROR] No .sha256 checksum file found next to ${DUMP_NAME}; refusing to restore without verifying the archive." >&2
  exit 1
fi

# 3. Load a privileged connection URL. Restore must not use the tenant-scoped
# runtime account because RLS can prevent complete restoration.
load_env() {
  local env_file="$1"
  if [[ -f "${env_file}" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      if [[ -n "${line}" && ! "${line}" =~ ^# && "${line}" =~ = ]]; then
        local key="${line%%=*}"
        local val="${line#*=}"
        val="${val%\"}"; val="${val#\"}"
        val="${val%\\'}"; val="${val#\\'}"
        if [[ -z "${!key:-}" ]]; then export "${key}=${val}"; fi
      fi
    done < "${env_file}"
  fi
}

if [[ -z "${DATABASE_DIRECT_URL:-${DIRECT_URL:-${DATABASE_URL:-}}}" ]]; then
  load_env "${PROJECT_ROOT}/.env"
  load_env "${PROJECT_ROOT}/backend/.env"
fi

source_url="${DATABASE_DIRECT_URL:-${DIRECT_URL:-${DATABASE_URL:-}}}"
if [[ "${DOCKER_MODE}" == "true" && -n "${DOCKER_DIRECT_URL:-}" ]]; then
  source_url="${DOCKER_DIRECT_URL}"
fi
if [[ -z "${source_url}" ]]; then
  echo "[ERROR] A privileged connection URL is required. Set DATABASE_DIRECT_URL (preferred), DIRECT_URL, or DATABASE_URL."
  exit 2
fi

# shellcheck source=connection.sh
source "${SCRIPT_DIR}/connection.sh"
source_url="$(normalize_pg_uri "${source_url}")"
DB_USER="$(pg_uri_field "${source_url}" username)"
DB_PASS="$(pg_uri_field "${source_url}" password)"
DB_HOST="$(pg_uri_field "${source_url}" hostname)"
DB_PORT="$(pg_uri_field "${source_url}" port)"
SOURCE_DB="$(pg_uri_database "${source_url}")"
if [[ "${SCRATCH_MODE}" == "true" ]]; then
  DB_NAME="${TARGET_DB:-assetvault_restore_test}"
else
  DB_NAME="${TARGET_DB:-${SOURCE_DB}}"
fi

if [[ ! "${DB_NAME}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
  echo "[ERROR] Invalid target database name '${DB_NAME}'. Use a simple PostgreSQL identifier (letters, digits, underscores; 63 characters max)."
  exit 2
fi

ADMIN_URL="$(pg_uri_with_database "${source_url}" "postgres")"
TARGET_URL="$(pg_uri_with_database "${source_url}" "${DB_NAME}")"
export PGPASSWORD="${DB_PASS}"

echo "================================================================================"
echo " AssetVault: Database Restoration Engine"
echo " Archive File   : ${DUMP_FILE}"
echo " Target Database: ${DB_NAME} @ ${DB_HOST}:${DB_PORT} (User: ${DB_USER})"
echo " Mode           : $(if [[ "${SCRATCH_MODE}" == "true" ]]; then echo "Isolated Scratch Test"; else echo "Live Production Restoration"; fi)"
echo "================================================================================"

# 4. Confirmation
if [[ "${YES_MODE}" != "true" && "${SCRATCH_MODE}" != "true" ]]; then
  echo ""
  echo "[WARNING] Restoring into live database '${DB_NAME}' will overwrite existing records!"
  read -p "Are you sure you want to continue? [y/N]: " CONFIRM
  if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
    echo "[ABORTED] Restoration cancelled by user."
    exit 0
  fi
fi

# 5. Scratch Database Setup
if [[ "${SCRATCH_MODE}" == "true" ]]; then
  echo "[2/3] Setting up scratch database '${DB_NAME}'..."
  if [[ "${DOCKER_MODE}" == "true" ]]; then
    docker compose exec -T -e PGPASSWORD="${DB_PASS}" db psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" -c "CREATE DATABASE ${DB_NAME};"
  else
    psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};" -c "CREATE DATABASE ${DB_NAME};"
  fi
fi

# 6. Execution
echo "[3/3] Restoring schema and database rows..."
if [[ "${DOCKER_MODE}" == "true" ]]; then
  if [[ "${DUMP_FILE}" =~ \.sql$ ]]; then
    docker compose exec -T -e PGPASSWORD="${DB_PASS}" db psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" < "${DUMP_FILE}"
  else
    docker compose exec -T -e PGPASSWORD="${DB_PASS}" db pg_restore -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner < "${DUMP_FILE}"
  fi
else
  PG_RESTORE_CMD="pg_restore"
  if ! command -v pg_restore &> /dev/null; then
    for cand in /usr/lib/postgresql/*/bin/pg_restore /usr/local/opt/libpq/bin/pg_restore; do
      if [[ -x "${cand}" ]]; then
        PG_RESTORE_CMD="${cand}"
        break
      fi
    done
  fi

  if [[ "${DUMP_FILE}" =~ \.sql$ ]]; then
    psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -f "${DUMP_FILE}"
  else
    "${PG_RESTORE_CMD}" --dbname="${TARGET_URL}" --exit-on-error --clean --if-exists --no-owner "${DUMP_FILE}"
  fi
fi

echo ""
echo "================================================================================"
echo " Restoration Completed Successfully into '${DB_NAME}'."
echo "================================================================================"
