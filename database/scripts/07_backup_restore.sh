#!/usr/bin/env bash
# ==============================================================================
# AssetVault: Automated PostgreSQL Backup & Restore Utility
# Course: VIT, BCSE307L Database Systems (Fall 2026-27)
# ==============================================================================

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-assetvault_db}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./database/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

usage() {
    echo "Usage: $0 {backup|backup-schema|restore <backup_file>|backup-tenant <tenant_id>}"
    exit 1
}

backup_full() {
    local target_file="$BACKUP_DIR/assetvault_full_$TIMESTAMP.sql"
    echo "--> Initiating complete PostgreSQL backup of $DB_NAME to $target_file..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -b -v -f "$target_file" "$DB_NAME"
    echo "--> Full backup successfully created: $target_file"
}

backup_schema() {
    local target_file="$BACKUP_DIR/assetvault_schema_$TIMESTAMP.sql"
    echo "--> Initiating schema-only backup of $DB_NAME..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --schema-only -f "$target_file" "$DB_NAME"
    echo "--> Schema backup successfully created: $target_file"
}

restore_db() {
    local backup_file="${1:-}"
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        echo "Error: Specified backup file does not exist."
        exit 1
    fi
    echo "--> Restoring database $DB_NAME from $backup_file..."
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v --clean "$backup_file" || true
    echo "--> Restore completed."
}

case "${1:-}" in
    backup)
        backup_full
        ;;
    backup-schema)
        backup_schema
        ;;
    restore)
        restore_db "${2:-}"
        ;;
    *)
        usage
        ;;
esac
