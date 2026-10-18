# ==============================================================================
# AssetVault: Native PostgreSQL Database Backup Script (Windows PowerShell)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Native tools: pg_dump (Custom -Fc & Plain SQL -Fp) + SHA-256 + 7-Day Retention
# ==============================================================================

[CmdletBinding()]
param (
    [string]$BackupDir = "",
    [switch]$Docker = $false,
    [string]$TargetDb = ""
)

$ErrorActionPreference = "Stop"

# 1. Determine Repository Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
    $BackupDir = Join-Path $ProjectRoot "backups"
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "[INFO] Created backup directory: $BackupDir" -ForegroundColor Cyan
}

# 2. Load .env sources without replacing explicitly supplied environment variables.
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
$DbName = if ($TargetDb) { $TargetDb } else { $ConnectionDetails.database }

if ([string]::IsNullOrWhiteSpace($DbName)) {
    throw "The PostgreSQL URL must include a database name, or pass -TargetDb."
}
$ConnectionUrl = Normalize-PgConnectionUrl -Url $ConnectionUrl -Database $DbName
$env:PGPASSWORD = $DbPass

# 4. Locate pg_dump tool
$PgDumpExe = "pg_dump"
if ($Docker) {
    Write-Host "[INFO] Operating in Docker container mode (docker compose exec)..." -ForegroundColor Cyan
} else {
    $found = Get-Command "pg_dump" -ErrorAction SilentlyContinue
    if (-not $found) {
        $candidates = @(
            "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) {
                $PgDumpExe = $c
                break
            }
        }
    }
}

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " AssetVault: Database Backup Engine" -ForegroundColor Green
Write-Host " Target Database : $DbName @ $DbHost`:$DbPort (User: $DbUser)" -ForegroundColor Green
Write-Host " Backup Directory: $BackupDir" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green

# 5. Generate Timestamps & File Paths
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$CustomDumpName = "assetvault_$Timestamp.dump"
$PlainSqlName   = "assetvault_$Timestamp.sql"
$CustomDumpPath = Join-Path $BackupDir $CustomDumpName
$PlainSqlPath   = Join-Path $BackupDir $PlainSqlName
$ChecksumPath   = Join-Path $BackupDir "$CustomDumpName.sha256"

# 6. Execute Backups
if ($Docker) {
    Write-Host "[1/3] Generating custom format binary dump (-Fc) via Docker..." -ForegroundColor Yellow
    docker compose exec -T -e "PGPASSWORD=$DbPass" db pg_dump -U $DbUser -d $DbName -Fc > $CustomDumpPath
    if ($LASTEXITCODE -ne 0) { throw "Docker pg_dump custom format failed with code $LASTEXITCODE" }
    Write-Host "[2/3] Generating readable plain SQL dump (-Fp) via Docker..." -ForegroundColor Yellow
    docker compose exec -T -e "PGPASSWORD=$DbPass" db pg_dump -U $DbUser -d $DbName -Fp > $PlainSqlPath
    if ($LASTEXITCODE -ne 0) { throw "Docker pg_dump plain SQL failed with code $LASTEXITCODE" }
} else {
    Write-Host "[1/3] Generating custom format binary dump (-Fc)..." -ForegroundColor Yellow
    & $PgDumpExe $ConnectionUrl -Fc -f $CustomDumpPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump custom format failed with code $LASTEXITCODE" }

    Write-Host "[2/3] Generating readable plain SQL dump (-Fp)..." -ForegroundColor Yellow
    & $PgDumpExe $ConnectionUrl -Fp -f $PlainSqlPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump plain SQL failed with code $LASTEXITCODE" }
}

# 7. Generate SHA-256 Checksum
Write-Host "[3/3] Generating SHA-256 cryptographic checksum..." -ForegroundColor Yellow
$hashResult = Get-FileHash -Path $CustomDumpPath -Algorithm SHA256
$hashString = "$($hashResult.Hash.ToLower())  $CustomDumpName"
[System.IO.File]::WriteAllText($ChecksumPath, $hashString)

$dumpSize = (Get-Item $CustomDumpPath).Length / 1KB
$sqlSize = (Get-Item $PlainSqlPath).Length / 1KB

Write-Host "`n[SUCCESS] Backup Generated Successfully:" -ForegroundColor Green
Write-Host "  - Custom Binary Dump: $CustomDumpPath ($([math]::Round($dumpSize, 2)) KB)" -ForegroundColor Gray
Write-Host "  - Plain Text SQL Dump: $PlainSqlPath ($([math]::Round($sqlSize, 2)) KB)" -ForegroundColor Gray
Write-Host "  - SHA-256 Checksum  : $($hashResult.Hash)" -ForegroundColor Gray

# 8. Retention Policy: Retain Only Latest 7 Backups
Write-Host "`n[INFO] Enforcing 7-Day Backup Retention Policy..." -ForegroundColor Cyan
$allDumps = Get-ChildItem -Path $BackupDir -Filter "assetvault_*.dump" | Sort-Object LastWriteTime -Descending

if ($allDumps.Count -gt 7) {
    $staleDumps = $allDumps | Select-Object -Skip 7
    foreach ($stale in $staleDumps) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($stale.Name)
        $associatedFiles = @(
            $stale.FullName,
            (Join-Path $BackupDir "$baseName.sql"),
            (Join-Path $BackupDir "$($stale.Name).sha256")
        )
        foreach ($f in $associatedFiles) {
            if (Test-Path $f) {
                Remove-Item -Path $f -Force
                Write-Host "  - Purged expired archive: $(Split-Path $f -Leaf)" -ForegroundColor DarkYellow
            }
        }
    }
} else {
    Write-Host "  - Currently $($allDumps.Count) backup archive(s) stored (Retention limit: 7)." -ForegroundColor Gray
}

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " Backup Completed Successfully." -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
