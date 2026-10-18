#!/usr/bin/env bash
# Shared PostgreSQL connection-URI helpers for native backup/restore scripts.
# These helpers normalize Prisma-only query parameters but preserve libpq options
# such as sslmode, and never print or log a credential-bearing URL.

normalize_pg_uri() {
  node -e '
    const u = new URL(process.argv[1]);
    if (!["postgres:", "postgresql:"].includes(u.protocol)) {
      throw new Error("Expected a PostgreSQL connection URI.");
    }
    for (const key of ["schema", "pgbouncer", "connection_limit", "pool_timeout"]) {
      u.searchParams.delete(key);
    }
    process.stdout.write(u.toString());
  ' "$1"
}

pg_uri_database() {
  node -e '
    const u = new URL(process.argv[1]);
    process.stdout.write(decodeURIComponent(u.pathname.replace(/^\/+/, "")));
  ' "$1"
}

pg_uri_field() {
  node -e '
    const u = new URL(process.argv[1]);
    const key = process.argv[2];
    const fields = {
      username: () => decodeURIComponent(u.username),
      password: () => decodeURIComponent(u.password),
      hostname: () => u.hostname,
      port: () => u.port || "5432",
      database: () => decodeURIComponent(u.pathname.replace(/^\/+/, ""))
    };
    if (!fields[key]) throw new Error("Unsupported PostgreSQL URI field.");
    process.stdout.write(fields[key]());
  ' "$1" "$2"
}

pg_uri_with_database() {
  node -e '
    const u = new URL(process.argv[1]);
    const dbName = process.argv[2];
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(dbName)) {
      throw new Error("Invalid target database identifier.");
    }
    u.pathname = "/" + dbName;
    process.stdout.write(u.toString());
  ' "$1" "$2"
}
