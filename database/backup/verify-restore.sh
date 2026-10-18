#!/usr/bin/env bash
# ==============================================================================
# AssetVault: Restore Verification & Table Row Count Comparison (Bash / Linux)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Restores into scratch DB and compares row counts across all user tables
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RESTORE_SCRIPT="${SCRIPT_DIR}/restore.sh"

DUMP_FILE=""
KEEP_SCRATCH=false
DOCKER_MODE=false
# Avoid dropping an unrelated database that happens to use a fixed test name.
SCRATCH_DB="${SCRATCH_DB:-assetvault_restore_test_$(date -u +%Y%m%d%H%M%S)_${BASHPID}}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-scratch)
      KEEP_SCRATCH=true
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

echo "================================================================================"
echo " AssetVault: Database Restore Verification Drill"
echo "================================================================================"

# 2. Load privileged direct connection details. The application URL may be
# restricted by RLS and can yield incomplete row counts or incomplete backups.
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
  echo "[ERROR] A privileged connection URL is required for restore verification. Set DATABASE_DIRECT_URL, DIRECT_URL or DATABASE_URL."
  exit 2
fi

# shellcheck source=connection.sh
source "${SCRIPT_DIR}/connection.sh"
source_url="$(normalize_pg_uri "${source_url}")"
DB_USER="$(pg_uri_field "${source_url}" username)"
DB_PASS="$(pg_uri_field "${source_url}" password)"
SOURCE_DB="$(pg_uri_database "${source_url}")"
export PGPASSWORD="${DB_PASS}"

cleanup_scratch() {
  local original_status="$?"
  local cleanup_status=0
  trap - EXIT
  if [[ "${KEEP_SCRATCH}" != "true" ]]; then
    echo ""
    echo "[STEP 3/3] Dropping transient scratch database '${SCRATCH_DB}'..."
    if [[ "${DOCKER_MODE}" == "true" ]]; then
      docker compose exec -T -e PGPASSWORD="${DB_PASS}" db psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" > /dev/null || cleanup_status=$?
    else
      psql "$(pg_uri_with_database "${source_url}" "postgres")" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" > /dev/null || cleanup_status=$?
    fi
    if [[ "${cleanup_status}" -eq 0 ]]; then
      echo "[INFO] Scratch database cleaned up."
    else
      echo "[ERROR] Could not clean up scratch database '${SCRATCH_DB}'." >&2
    fi
  fi
  if [[ "${original_status}" -eq 0 && "${cleanup_status}" -ne 0 ]]; then
    original_status="${cleanup_status}"
  fi
  exit "${original_status}"
}
trap cleanup_scratch EXIT

# 1. Restore into scratch DB
echo "[STEP 1/3] Restoring backup archive into scratch database '${SCRATCH_DB}'..."
RESTORE_CMD=("${RESTORE_SCRIPT}" "--scratch" "--target-db" "${SCRATCH_DB}" "-y")
if [[ -n "${DUMP_FILE}" ]]; then
  RESTORE_CMD+=("${DUMP_FILE}")
fi
if [[ "${DOCKER_MODE}" == "true" ]]; then
  RESTORE_CMD+=("--docker")
fi
"${RESTORE_CMD[@]}"


run_sql() {
  local target_db="$1"
  local sql="$2"
  if [[ ! "${target_db}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
    echo "[ERROR] Invalid database identifier requested for verification." >&2
    return 2
  fi
  if [[ "${DOCKER_MODE}" == "true" ]]; then
    docker compose exec -T -e PGPASSWORD="${DB_PASS}" db psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${target_db}" -t -A -c "${sql}" | tr -d '\r'
  else
    local target_url
    target_url="$(pg_uri_with_database "${source_url}" "${target_db}")"
    psql "${target_url}" -v ON_ERROR_STOP=1 -t -A -c "${sql}" | tr -d '\r'
  fi
}

echo ""
echo "[STEP 2/3] Querying table catalog and calculating row counts..."

TABLE_QUERY="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '_prisma%' ORDER BY table_name;"
TABLES=$(run_sql "${SOURCE_DB}" "${TABLE_QUERY}")
if [[ -z "${TABLES//[[:space:]]/}" ]]; then
  echo "[ERROR] No base tables found in source database '${SOURCE_DB}'."
  exit 1
fi

echo ""
echo "================================================================================"
echo " DATABASE RESTORATION VERIFICATION REPORT"
echo " Source Database : ${SOURCE_DB}"
echo " Scratch Database: ${SCRATCH_DB}"
echo "================================================================================"
printf "%-32s %14s %14s %10s\n" "Table Name" "Source Rows" "Scratch Rows" "Status"
printf '%*s\n' 74 '' | tr ' ' '-'

ALL_PASSED=true

while IFS= read -r tbl || [[ -n "${tbl}" ]]; do
  [[ -z "${tbl}" ]] && continue
  COUNT_SQL="SELECT COUNT(*) FROM \"${tbl}\";"
  SRC_COUNT="$(run_sql "${SOURCE_DB}" "${COUNT_SQL}")"
  SCRATCH_COUNT="$(run_sql "${SCRATCH_DB}" "${COUNT_SQL}")"

  STATUS="PASS"
  if [[ "${SRC_COUNT}" != "${SCRATCH_COUNT}" ]]; then
    STATUS="FAIL"
    ALL_PASSED=false
  fi

  printf "%-32s %14s %14s %10s\n" "${tbl}" "${SRC_COUNT}" "${SCRATCH_COUNT}" "${STATUS}"
done <<< "${TABLES}"

printf '%*s\n' 74 '' | tr ' ' '='

if [[ "${ALL_PASSED}" == "true" ]]; then
  echo "[RESULT] PASS: All tables verified with exact row parity."
else
  echo "[RESULT] FAIL: Discrepancy detected between source and scratch databases!"
fi

if [[ "${ALL_PASSED}" != "true" ]]; then
  exit 1
fi
