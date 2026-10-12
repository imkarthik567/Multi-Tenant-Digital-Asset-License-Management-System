<#
==============================================================================
AssetVault: Automated PostgreSQL Backup & Restore Utility (PowerShell)
Course: VIT, BCSE307L Database Systems (Fall 2026-27)
==============================================================================
#>

param (
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("backup", "backup-schema", "restore")]
    [string]$Action,

    [Parameter(Position=1)]
    [string]$FilePath
)

$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "assetvault_db" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$BACKUP_DIR = "./database/backups"
$TIMESTAMP = (Get-Date).ToString("yyyyMMdd_HHmmss")

if (!(Test-Path -Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

switch ($Action) {
    "backup" {
        $Target = "$BACKUP_DIR/assetvault_full_$TIMESTAMP.sql"
        Write-Host "--> Starting full PostgreSQL backup to $Target..." -ForegroundColor Cyan
        & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -F c -b -v -f $Target $DB_NAME
        Write-Host "--> Backup created: $Target" -ForegroundColor Green
    }
    "backup-schema" {
        $Target = "$BACKUP_DIR/assetvault_schema_$TIMESTAMP.sql"
        Write-Host "--> Starting schema backup to $Target..." -ForegroundColor Cyan
        & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER --schema-only -f $Target $DB_NAME
        Write-Host "--> Schema backup created: $Target" -ForegroundColor Green
    }
    "restore" {
        if (-not $FilePath -or !(Test-Path -Path $FilePath)) {
            Write-Error "Please specify a valid backup file path to restore."
            exit 1
        }
        Write-Host "--> Restoring database from $FilePath..." -ForegroundColor Yellow
        & pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v --clean $FilePath
        Write-Host "--> Restore finished." -ForegroundColor Green
    }
}
