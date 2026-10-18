# ==============================================================================
# AssetVault: Native PostgreSQL Database Restore Script (Windows PowerShell)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Native tools: pg_restore (--clean --if-exists --no-owner) + Checksum Verification
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$DumpFile = "",
    [switch]$Scratch = $false,
    [string]$TargetDb = "",
    [switch]$Yes = $false,
    [switch]$Docker = $false
)

$ErrorActionPreference = "Stop"

# 1. Determine Repository Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$BackupDir = Join-Path $ProjectRoot "backups"

# 2. Resolve Dump File
if ([string]::IsNullOrWhiteSpace($DumpFile)) {
    # Find latest dump file in backups directory
    $latestDump = Get-ChildItem -Path $BackupDir -Filter "assetvault_*.dump" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latestDump) {
        throw "No backup file specified and no .dump files found in $BackupDir"
    }
    $DumpFile = $latestDump.FullName
    Write-Host "[INFO] No file specified. Auto-selected latest backup: $(Split-Path $DumpFile -Leaf)" -ForegroundColor Cyan
} else {
    if (-not (Test-Path $DumpFile)) {
        # Check inside backups dir if relative name provided
        $candidate = Join-Path $BackupDir $DumpFile
        if (Test-Path $candidate) {
            $DumpFile = $candidate
        } else {
            throw "Specified backup file does not exist: $DumpFile"
        }
    }
}

$DumpFileName = Split-Path $DumpFile -Leaf
$DumpFileDir  = Split-Path $DumpFile -Parent

# 3. Verify SHA-256 Checksum
$ChecksumFile = Join-Path $DumpFileDir "$DumpFileName.sha256"
if (Test-Path $ChecksumFile) {
    Write-Host "[1/3] Verifying SHA-256 checksum..." -ForegroundColor Yellow
    $expectedHashLine = (Get-Content $ChecksumFile | Select-Object -First 1).Trim()
    $expectedHash = ($expectedHashLine -split '\s+')[0].Trim().ToUpper()
    
    $actualHash = (Get-FileHash -Path $DumpFile -Algorithm SHA256).Hash.ToUpper()

    if ($expectedHash -ne $actualHash) {
        Write-Host "[ERROR] Cryptographic checksum mismatch!" -ForegroundColor Red
        Write-Host "  Expected: $expectedHash" -ForegroundColor Red
        Write-Host "  Actual  : $actualHash" -ForegroundColor Red
        throw "Integrity verification failed for backup file: $DumpFile"
    }
    Write-Host "[PASS] Checksum matched: $actualHash" -ForegroundColor Green
} else {
    throw "Checksum file is required before restore: $ChecksumFile"
}

# 4. Load Environment Variables from .env
function Load-EnvFile([string]$path) {
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $idx = $line.IndexOf("=")
                $key = $line.Substring(0, $idx).Trim()
                $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
                if (-not [System.Environment]::GetEnvironmentVariable($key)) {
                    [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
                }
            }
        }
    }
}

# Load each candidate .env file; Load-EnvFile does not override explicitly set process variables.
Load-EnvFile (Join-Path $ProjectRoot ".env")
Load-EnvFile (Join-Path $ProjectRoot "backend\.env")
Load-EnvFile (Join-Path $ProjectRoot "apps\api\.env")

. (Join-Path $ScriptDir "connection.ps1")
$ConnectionUrl = Get-PreferredPgConnectionUrl -Docker:$Docker
$ConnectionDetails = Get-PgConnectionDetails -Url $ConnectionUrl
$DbHost = $ConnectionDetails.hostname
$DbPort = $ConnectionDetails.port
$DbUser = $ConnectionDetails.username
$DbPass = $ConnectionDetails.password
$SourceDb = $ConnectionDetails.database

if ($Scratch) {
    $DbName = if ($TargetDb) { $TargetDb } else { "assetvault_restore_test" }
} else {
    $DbName = if ($TargetDb) { $TargetDb } else { $SourceDb }
}

if ([string]::IsNullOrWhiteSpace($DbName) -or $DbName -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') {
    throw "Invalid target database name. Use a PostgreSQL identifier containing letters, digits and underscores (max 63 characters)."
}

$AdminUrl = Normalize-PgConnectionUrl -Url $ConnectionUrl -Database "postgres"
$TargetUrl = Normalize-PgConnectionUrl -Url $ConnectionUrl -Database $DbName
$env:PGPASSWORD = $DbPass

# 6. Locate native tools (pg_restore, psql)
$PgRestoreExe = "pg_restore"
$PsqlExe = "psql"
if (-not $Docker) {
    $foundRestore = Get-Command "pg_restore" -ErrorAction SilentlyContinue
    if (-not $foundRestore) {
        $candidates = @(
            "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { $PgRestoreExe = $c; break }
        }
    }

    $foundPsql = Get-Command "psql" -ErrorAction SilentlyContinue
    if (-not $foundPsql) {
        $candidates = @(
            "C:\Program Files\PostgreSQL\18\bin\psql.exe",
            "C:\Program Files\PostgreSQL\17\bin\psql.exe",
            "C:\Program Files\PostgreSQL\16\bin\psql.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { $PsqlExe = $c; break }
        }
    }
}

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " AssetVault: Database Restoration Engine" -ForegroundColor Green
Write-Host " Archive File   : $DumpFile" -ForegroundColor Green
Write-Host " Target Database: $DbName @ $DbHost`:$DbPort (User: $DbUser)" -ForegroundColor Green
Write-Host " Mode           : $(if ($Scratch) { 'Isolated Scratch Test' } else { 'Live Production Restoration' })" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green

# 7. Interactive Confirmation Prompt
if (-not $Yes -and -not $Scratch) {
    Write-Host "`n[WARNING] Restoring into live database '$DbName' will overwrite tables and existing records!" -ForegroundColor Red
    $response = Read-Host "Are you sure you want to continue? [y/N]"
    if ($response -notmatch "^(y|yes)$") {
        Write-Host "[ABORTED] Restoration cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

# 8. Setup Scratch Database if requested
if ($Scratch) {
    Write-Host "[2/3] Preparing scratch database '$DbName'..." -ForegroundColor Cyan
    if ($Docker) {
        $existingScratch = & docker compose exec -T -e "PGPASSWORD=$DbPass" db psql -v ON_ERROR_STOP=1 -U $DbUser -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname = '$DbName';"
    } else {
        $existingScratch = & $PsqlExe $AdminUrl -v ON_ERROR_STOP=1 -t -A -c "SELECT 1 FROM pg_database WHERE datname = '$DbName';"
    }
    if ($LASTEXITCODE -ne 0) { throw "Could not check whether scratch database '$DbName' exists." }
    if (-not [string]::IsNullOrWhiteSpace(($existingScratch -join "").Trim())) {
        throw "Scratch database '$DbName' already exists; refusing to overwrite it."
    }
    if ($Docker) {
        & docker compose exec -T -e "PGPASSWORD=$DbPass" db psql -v ON_ERROR_STOP=1 -U $DbUser -d postgres -c "CREATE DATABASE $DbName;"
        if ($LASTEXITCODE -ne 0) { throw "Docker scratch database create failed with code $LASTEXITCODE" }
    } else {
        & $PsqlExe $AdminUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DbName;"
        if ($LASTEXITCODE -ne 0) { throw "Scratch database create failed with code $LASTEXITCODE" }
    }
}

# 9. Perform Restoration
Write-Host "[3/3] Restoring database schema and records..." -ForegroundColor Yellow

$isPlainSql = $DumpFile.EndsWith(".sql")

if ($Docker) {
    if ($isPlainSql) {
        Get-Content $DumpFile | docker compose exec -T -e "PGPASSWORD=$DbPass" db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName
        if ($LASTEXITCODE -ne 0) { throw "Docker psql restoration failed with code $LASTEXITCODE" }
    } else {
        # Copy the binary archive into the container. PowerShell's native pipeline
        # converts byte arrays to text on Windows PowerShell 5 and corrupts dumps.
        $containerId = (& docker compose ps -q db).Trim()
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
            throw "Unable to locate the running database container for Docker restore."
        }
        $containerDumpPath = "/tmp/assetvault_restore_$([Guid]::NewGuid().ToString('N')).dump"
        $resolvedDumpPath = (Resolve-Path $DumpFile).Path
        try {
            & docker cp $resolvedDumpPath "${containerId}:$containerDumpPath"
            if ($LASTEXITCODE -ne 0) { throw "Could not copy the dump archive into the database container." }

            & docker compose exec -T -e "PGPASSWORD=$DbPass" db pg_restore -U $DbUser -d $DbName --exit-on-error --clean --if-exists --no-owner $containerDumpPath
            if ($LASTEXITCODE -ne 0) { throw "Docker pg_restore failed with code $LASTEXITCODE" }
        } finally {
            & docker compose exec -T db rm -f $containerDumpPath | Out-Null
        }
    }
} else {
    if ($isPlainSql) {
        & $PsqlExe $TargetUrl -v ON_ERROR_STOP=1 -f $DumpFile
        if ($LASTEXITCODE -ne 0) { throw "psql restoration failed with code $LASTEXITCODE" }
    } else {
        & $PgRestoreExe --dbname=$TargetUrl --exit-on-error --clean --if-exists --no-owner $DumpFile
        if ($LASTEXITCODE -ne 0) {
            throw "pg_restore failed with error code $LASTEXITCODE"
        }
    }
}

Write-Host "`n================================================================================" -ForegroundColor Green
Write-Host " Restoration Completed Successfully into '$DbName'." -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
