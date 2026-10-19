# ==============================================================================
# AssetVault: Restore Verification & Table Row Count Comparison (Windows PowerShell)
# Restores into a unique scratch database and compares public base-table row counts.
# ==============================================================================

[CmdletBinding()]
param (
    [string]$DumpFile = "",
    [switch]$KeepScratch = $false,
    [switch]$Docker = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$RestoreScript = Join-Path $ScriptDir "restore.ps1"

function Load-EnvFile([string]$Path) {
    if (Test-Path $Path) {
        Get-Content $Path | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $idx = $line.IndexOf("=")
                $key = $line.Substring(0, $idx).Trim()
                $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
                if (-not [Environment]::GetEnvironmentVariable($key, "Process")) {
                    [Environment]::SetEnvironmentVariable($key, $value, "Process")
                }
            }
        }
    }
}

# Load missing values even when DATABASE_URL is exported so the preferred direct URL can be selected.
Load-EnvFile (Join-Path $ProjectRoot ".env")
Load-EnvFile (Join-Path $ProjectRoot "backend\.env")
. (Join-Path $ScriptDir "connection.ps1")
$ConnectionUrl = Get-PreferredPgConnectionUrl -Docker:$Docker
$ConnectionDetails = Get-PgConnectionDetails -Url $ConnectionUrl
$ScratchDb = "assetvault_restore_test_$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
$RestoreSucceeded = $false
$ExitCode = 0

$PsqlExe = "psql"
if (-not $Docker -and -not (Get-Command "psql" -ErrorAction SilentlyContinue)) {
    foreach ($candidate in @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe"
    )) {
        if (Test-Path $candidate) { $PsqlExe = $candidate; break }
    }
}

function Invoke-VerificationSql([string]$Database, [string]$Sql) {
    if ($Database -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') {
        throw "Invalid database identifier requested for verification."
    }

    if ($Docker) {
        $output = & docker compose exec -T -e "PGPASSWORD=$($ConnectionDetails.password)" db psql -v ON_ERROR_STOP=1 -U $ConnectionDetails.username -d $Database -t -A -c $Sql
    } else {
        $targetUrl = Normalize-PgConnectionUrl -Url $ConnectionUrl -Database $Database
        $output = & $PsqlExe $targetUrl -v ON_ERROR_STOP=1 -t -A -c $Sql
    }
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL verification query failed for database '$Database' (exit code $LASTEXITCODE)."
    }
    return (($output -join [Environment]::NewLine).Trim())
}

# Refuse to overwrite any existing database before calling restore.ps1.
$existingScratch = Invoke-VerificationSql "postgres" "SELECT 1 FROM pg_database WHERE datname = '$ScratchDb';"
if (-not [string]::IsNullOrWhiteSpace($existingScratch)) {
    throw "Scratch database '$ScratchDb' already exists; refusing to drop or overwrite it."
}

try {
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host " AssetVault: Database Restore Verification Drill" -ForegroundColor Cyan
    Write-Host " Source Database : $($ConnectionDetails.database)" -ForegroundColor Gray
    Write-Host " Scratch Database: $ScratchDb" -ForegroundColor Gray
    Write-Host "================================================================================" -ForegroundColor Cyan

    $restoreArgs = @("-Scratch", "-TargetDb", $ScratchDb, "-Yes")
    if ($DumpFile) { $restoreArgs += @("-DumpFile", $DumpFile) }
    if ($Docker) { $restoreArgs += "-Docker" }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $RestoreScript @restoreArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Restoration into scratch database failed with code $LASTEXITCODE."
    }
    $RestoreSucceeded = $true

    $tableQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '_prisma%' ORDER BY table_name;"
    $tableList = Invoke-VerificationSql $ConnectionDetails.database $tableQuery
    $tables = @($tableList -split "\r?\n" | Where-Object { $_ })
    if ($tables.Count -eq 0) {
        throw "No base tables found in source database '$($ConnectionDetails.database)'."
    }

    $allPassed = $true
    $results = foreach ($table in $tables) {
        $escapedTable = $table.Replace('"', '""')
        $countSql = 'SELECT COUNT(*) FROM "' + $escapedTable + '";'
        $sourceCount = Invoke-VerificationSql $ConnectionDetails.database $countSql
        $scratchCount = Invoke-VerificationSql $ScratchDb $countSql
        $status = if ($sourceCount -eq $scratchCount) { "PASS" } else { "FAIL" }
        if ($status -eq "FAIL") { $allPassed = $false }
        [PSCustomObject]@{ Table = $table; SourceRows = $sourceCount; ScratchRows = $scratchCount; Status = $status }
    }

    Write-Host ([Environment]::NewLine + ("{0,-32} {1,14} {2,14} {3,10}" -f "Table Name", "Source Rows", "Scratch Rows", "Status")) -ForegroundColor Cyan
    Write-Host ("-" * 74) -ForegroundColor Gray
    foreach ($result in $results) {
        $color = if ($result.Status -eq "PASS") { "Green" } else { "Red" }
        Write-Host ("{0,-32} {1,14} {2,14} {3,10}" -f $result.Table, $result.SourceRows, $result.ScratchRows, $result.Status) -ForegroundColor $color
    }

    if (-not $allPassed) {
        throw "Table row counts differ between source and scratch databases."
    }
    Write-Host "[RESULT] PASS: All $($tables.Count) tables verified with exact row parity." -ForegroundColor Green
} catch {
    $ExitCode = 1
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if (-not $KeepScratch -and $RestoreSucceeded) {
        try {
            if ($Docker) {
                & docker compose exec -T -e "PGPASSWORD=$($ConnectionDetails.password)" db psql -v ON_ERROR_STOP=1 -U $ConnectionDetails.username -d postgres -c "DROP DATABASE $ScratchDb;" | Out-Null
            } else {
                $adminUrl = Normalize-PgConnectionUrl -Url $ConnectionUrl -Database "postgres"
                & $PsqlExe $adminUrl -v ON_ERROR_STOP=1 -c "DROP DATABASE $ScratchDb;" | Out-Null
            }
            if ($LASTEXITCODE -ne 0) { throw "Scratch database cleanup failed with code $LASTEXITCODE." }
            Write-Host "[INFO] Scratch database cleaned up." -ForegroundColor Gray
        } catch {
            $ExitCode = 1
            Write-Host "[ERROR] Could not clean up scratch database '$ScratchDb': $($_.Exception.Message)" -ForegroundColor Red
        }
    } elseif ($KeepScratch -and $RestoreSucceeded) {
        Write-Host "[INFO] Scratch database '$ScratchDb' retained for manual inspection." -ForegroundColor Yellow
    } elseif (-not $RestoreSucceeded) {
        Write-Host "[WARN] Restore did not complete; leaving any scratch database untouched for safety." -ForegroundColor Yellow
    }
}

if ($ExitCode -ne 0) { exit $ExitCode }
