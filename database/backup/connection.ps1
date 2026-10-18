# Shared PostgreSQL URI helpers for native Windows backup/restore scripts.
# Requires Node.js (already required by AssetVault) and never prints connection secrets.

function Get-PreferredPgConnectionUrl {
    param([switch]$Docker)

    $url = $null
    if ($Docker -and $env:DOCKER_DIRECT_URL) {
        $url = $env:DOCKER_DIRECT_URL
    } elseif ($env:DATABASE_DIRECT_URL) {
        $url = $env:DATABASE_DIRECT_URL
    } elseif ($env:DIRECT_URL) {
        $url = $env:DIRECT_URL
    } elseif ($env:DATABASE_URL) {
        $url = $env:DATABASE_URL
    }

    if ([string]::IsNullOrWhiteSpace($url)) {
        throw "A privileged PostgreSQL URL is required. Set DATABASE_DIRECT_URL (preferred), DIRECT_URL, or DATABASE_URL."
    }

    return Normalize-PgConnectionUrl -Url $url
}

function Normalize-PgConnectionUrl {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [string]$Database = ""
    )

    $script = @'
const u = new URL(process.argv[1]);
if (!["postgres:", "postgresql:"].includes(u.protocol)) {
  throw new Error("Expected a PostgreSQL connection URL.");
}
for (const key of ["schema", "pgbouncer", "connection_limit", "pool_timeout"]) {
  u.searchParams.delete(key);
}
const database = process.argv[2] || "";
if (database) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(database)) {
    throw new Error("Invalid PostgreSQL target database identifier.");
  }
  u.pathname = "/" + database;
}
process.stdout.write(u.toString());
'@
    $result = & node -e $script $Url $Database
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($result)) {
        throw "Unable to parse PostgreSQL connection URL."
    }
    return [string]$result
}

function Get-PgConnectionDetails {
    param([Parameter(Mandatory = $true)][string]$Url)

    $script = @'
const u = new URL(process.argv[1]);
const detail = {
  username: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  hostname: u.hostname,
  port: u.port || "5432",
  database: decodeURIComponent(u.pathname.replace(/^\/+/, ""))
};
process.stdout.write(JSON.stringify(detail));
'@
    $result = & node -e $script $Url
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($result)) {
        throw "Unable to parse PostgreSQL connection URL fields."
    }
    return ($result | ConvertFrom-Json)
}
