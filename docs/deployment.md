# AssetVault: Free-Cloud Production Deployment Guide
**Platform Stack**: Supabase (PostgreSQL 16) + Render (Docker API) + Vercel (React Frontend SPA)  
**Academic Coursework**: VIT, BCSE307L Database Systems (Fall 2026-27)

---

## 1. Architecture Overview

AssetVault is designed for zero-cost, high-reliability deployment on modern free-tier cloud platforms:

```
                      ┌──────────────────────────────────────────────┐
                      │              Client Browser                  │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTPS
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │            Vercel Frontend CDN               │
                      │  - Vite React SPA                            │
                      │  - Automatic Let's Encrypt TLS               │
                      │  - Rewrites /api/* -> Render Backend         │
                      └──────────────────────┬───────────────────────┘
                                             │ Reverse Proxy / HTTPS
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │             Render Web Service               │
                      │  - Multi-stage Docker Container (Node 22)    │
                      │  - Express API + In-Process Worker Cron      │
                      │  - PostgreSQL Advisory Locks (1001-1003)     │
                      └──────────────┬───────────────────────────────┘
                                     │
           Pooled Connection (6543)  │  Direct Connection (5432)
         (DATABASE_URL?pgbouncer=true)│  (DIRECT_URL for Migrations)
                                     ▼
                      ┌──────────────────────────────────────────────┐
                      │             Supabase Cloud DB                │
                      │  - PostgreSQL 16 with Row-Level Security     │
                      │  - pg_trgm, uuid-ossp, btree_gist extensions │
                      │  - Restricted assetvault_app runtime role    │
                      └──────────────────────────────────────────────┘
```

---

## 2. Step 1: Database Setup (Supabase)

### A. Create Project & Extensions
1. Sign up or log in at [supabase.com](https://supabase.com) (Free Tier).
2. Create a new organization and project named `assetvault-production`.
3. Select your preferred AWS region (e.g., `us-east-1` or `ap-southeast-1`).
4. Note your database master password.
5. In the Supabase Dashboard, navigate to **Database** -> **Extensions** and ensure the following are enabled:
   - `uuid-ossp`
   - `pg_trgm` (for trigram global search)
   - `btree_gist` (for temporal exclusion constraints)

### B. Connection String Architecture
Supabase provides two distinct connection strings in **Project Settings** -> **Database**:
1. **Transaction Pooler (Port 6543)**: Used for application runtime (`DATABASE_URL`) and must authenticate as the restricted `assetvault_app` role. On Supabase, use the role-qualified username required by your project/pooler:
   ```
   postgresql://assetvault_app.[project-ref]:[APP_DB_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
   ```
2. **Direct Connection (Port 5432)**: Used only for migrations, initial role bootstrap, seeding, and trusted background maintenance (`DIRECT_URL`). Keep this privileged credential separate from the runtime URL:
   ```
   postgresql://postgres.[project-ref]:[DB_PASSWORD]@db.[project-ref].supabase.co:5432/postgres
   ```

Set `APP_DB_PASSWORD` to a strong random value of at least 32 characters and use the same value for the password embedded in the restricted `DATABASE_URL`. Prefer a `DIRECT_URL` without Prisma-only query parameters (notably `schema=public`) because it is used by the psql bootstrap command; the entrypoint defensively removes the `schema` parameter before invoking psql. The startup entrypoint uses `DIRECT_URL` to create/update the restricted role, then the HTTP API connects using `DATABASE_URL`. Do not configure `DATABASE_URL` with the `postgres` administrator credentials.

### C. Create Restricted Runtime Role (`assetvault_app`)
To adhere strictly to the principle of least privilege, run the production bootstrap script using the Supabase SQL Editor or `psql`:

```bash
# Execute 08_production_bootstrap.sql against your Supabase Direct URL
APP_DB_PASSWORD="<STRONG_RANDOM_DBPASS>"
psql "$DIRECT_URL" -v DBPASS="$APP_DB_PASSWORD" -f database/sql/08_production_bootstrap.sql
```

The Docker/Render entrypoint runs this bootstrap after migrations. For manual setup, the same script sets a supplied password, enables login for `assetvault_app`, grants runtime DML access, and revokes schema-creation rights. Never use a fallback/default password.

### D. Apply Migrations & Reference Data
From your local terminal or CI/CD runner:

```bash
# 1. Apply Prisma migrations to the cloud database
DIRECT_URL="<YOUR_SUPABASE_DIRECT_URL>" npx prisma migrate deploy --schema backend/prisma/schema.prisma

# 2. Seed system roles, subscription plans, license types and initial Super Admin
DIRECT_URL="<YOUR_SUPABASE_DIRECT_URL>" \
DATABASE_URL="<YOUR_RESTRICTED_ASSETVAULT_APP_POOLED_URL>" \
SEED_DATABASE_URL="<YOUR_SUPABASE_DIRECT_URL>" \
SEED_DEMO="false" \
SUPER_ADMIN_EMAIL="admin@yourdomain.com" \
SUPER_ADMIN_PASSWORD="<STRONG_ADMIN_PASSWORD>" \
APP_DB_PASSWORD="<STRONG_RANDOM_DBPASS>" \
npm run db:seed
```

---

## 3. Step 2: Backend API Deployment (Render)

### Option A: Render Blueprint (Recommended)
1. Fork or push your AssetVault repository to GitHub.
2. In [dashboard.render.com](https://dashboard.render.com), click **New** -> **Blueprint**.
3. Connect your repository. Render automatically reads root [`render.yaml`](../render.yaml).
4. Set `DATABASE_URL` to the restricted `assetvault_app` pooler URL, `DIRECT_URL` to the privileged direct URL, and `APP_DB_PASSWORD` to a strong random password of at least 32 characters. Render can auto-generate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET`; they must remain distinct.
5. Click **Apply**.

### Option B: Manual Web Service
1. In Render, select **New** -> **Web Service**.
2. Connect your Git repository.
3. Choose **Docker** environment.
4. Set **Dockerfile Path**: `backend/Dockerfile`.
5. Set **Docker Context**: `.` (root directory).
6. Set **Health Check Path**: `/api/health`.
7. Select the **Free** instance type.
8. Add the environment variables listed in Section 5 below.

---

## 4. Step 3: Frontend Deployment (Vercel)

1. Log in to [vercel.com](https://vercel.com) and click **Add New** -> **Project**.
2. Import your GitHub repository.
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set Environment Variables:
   - `VITE_API_URL`: `https://assetvault-api.onrender.com/api` (or `/api` if using Vercel rewrites)
5. Deploy. Vercel automatically honors [`frontend/vercel.json`](../frontend/vercel.json) for SPA routing and API reverse-proxying.

---

## 5. Complete Environment Variable Reference Table

| Variable Name | Service | Required? | Example Placeholder | Purpose & Security Note |
|---|---|---|---|---|
| `NODE_ENV` | Render | Yes | `production` | Enables HSTS, secure cookies, suppresses stack traces. |
| `PORT` | Render | Yes | `5000` | Port for Express HTTP listener. |
| `DATABASE_URL` | Render | Yes | `postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true` | Supabase pooled connection string. Never commit. |
| `DIRECT_URL` | Render / CI | Yes | `postgresql://...@aws-0.supabase.com:5432/postgres` | Supabase direct connection for migrations. |
| `CLIENT_URL` | Render | Yes | `https://assetvault.vercel.app,https://yourdomain.duckdns.org` | Comma-separated list of allowed frontend origins for CORS. |
| `CORS_ORIGIN` | Render | Yes | `https://assetvault.vercel.app` | Primary CORS origin matching frontend domain. |
| `JWT_ACCESS_SECRET` | Render | Yes | `min-32-chars-random-cryptographic-key` | Signs short-lived access JWTs (15m expiry). |
| `JWT_REFRESH_SECRET` | Render | Yes | `min-32-chars-random-cryptographic-key` | Validates refresh tokens (7d expiry). |
| `COOKIE_SECRET` | Render | Yes | `min-32-chars-random-cryptographic-key` | Signs httpOnly cookies. |
| `COOKIE_SAMESITE` | Render | Yes | `none` | Required for the default Vercel (`vercel.app`) + Render (`onrender.com`) cross-site deployment; the refresh cookie is `Secure` in production. Use `strict`/`lax` only when frontend and API are same-site. |
| `ENABLE_IN_PROCESS_WORKER` | Render | Yes | `true` | Runs cron jobs inside the API process with advisory locks. |
| `METRICS_BEARER_TOKEN` | Render | Yes | `assetvault-metrics-secret-token` | Protects `/metrics` Prometheus telemetry endpoint. |
| `GOOGLE_CLIENT_ID` | Render | Optional | `12345.apps.googleusercontent.com` | Google OAuth Client ID for enterprise SSO. |
| `GOOGLE_CLIENT_SECRET` | Render | Optional | `GOCSPX-abc123secret` | Google OAuth Client Secret. Never commit. |
| `GOOGLE_CALLBACK_URL` | Render | Optional | `https://assetvault-api.onrender.com/api/v1/auth/google/callback` | Callback URL registered in Google Cloud Console. |
| `SMTP_HOST` | Render | Optional | `smtp.ethereal.email` | Transactional email provider host. |
| `SMTP_PORT` | Render | Optional | `587` | SMTP port (587 TLS or 465 SSL). |
| `SMTP_USER` | Render | Optional | `your_smtp_user` | SMTP authentication user. |
| `SMTP_PASS` | Render | Optional | `your_smtp_password` | SMTP authentication password. |
| `SMTP_FROM` | Render | Optional | `AssetVault <notifications@assetvault.io>` | Outgoing sender identity. |
| `SUPER_ADMIN_EMAIL` | Render / Local | Yes | `superadmin@assetvault.io` | Initial global administrator login email. |
| `SUPER_ADMIN_PASSWORD` | Render / Local | Yes | `<Set in secret store>` | Initial administrator password. Rotate upon first login. |
| `SEED_DEMO` | Render | Optional | `false` | Set to `false` for production, `true` for demo tenants. |
| `RENDER_DEPLOY_HOOK_URL`| GitHub Secret| Optional | `https://api.render.com/deploy/srv-xxx?key=yyy` | Triggered by CI/CD upon successful main builds. |
| `RENDER_API_URL` | GitHub Secret| Optional | `https://assetvault-api.onrender.com` | Target URL polled by health verification & keepalive. |

---

## 6. First Login & Verification

1. Open your Vercel deployment URL (e.g. `https://assetvault.vercel.app`).
2. Navigate to `/login`.
3. Log in with:
   - **Email**: The value set in `SUPER_ADMIN_EMAIL`
   - **Password**: The value set in `SUPER_ADMIN_PASSWORD`
4. Access the **Super Admin Console** to create organizations, assign plans, and invite Tenant Administrators.
5. In your profile settings, immediately change the Super Admin password.

---

## 7. Production Smoke Test Checklist

Execute these checks after every production deployment:

- [ ] **Health Endpoint**: `curl -I https://assetvault-api.onrender.com/api/health` returns HTTP 200 OK.
- [ ] **Database Readiness**: `curl https://assetvault-api.onrender.com/api/ready` returns `status: "ready"` and database latency < 50ms.
- [ ] **Protected Metrics**: `curl -H "Authorization: Bearer <METRICS_BEARER_TOKEN>" https://assetvault-api.onrender.com/metrics` returns Prometheus metrics.
- [ ] **CORS Verification**: Requests with `Origin: https://assetvault.vercel.app` return `Access-Control-Allow-Origin`.
- [ ] **Authentication Flow**: Login returns access token in response body and sets httpOnly `refreshToken` cookie.
- [ ] **SSE Stream**: Navigating into the dashboard establishes `/api/notifications/stream` connection.
- [ ] **License Allocation**: Allocating a user seat succeeds and decrements available seats in `v_license_utilization`.
- [ ] **Document Export**: PDF dossier and CSV audit log downloads succeed.
- [ ] **Keepalive Cron**: GitHub Actions keepalive ping runs every 10 minutes to eliminate Render cold start delays.

---

## 8. Rollback Procedures

### API Rollback (Render)
1. Go to **Dashboard** -> **assetvault-api** -> **Deploys**.
2. Select the previous stable deployment.
3. Click **Rollback to this deploy**.

### Frontend Rollback (Vercel)
1. Go to **Project** -> **Deployments**.
2. Locate the previous working production deployment.
3. Click the three dots (`...`) -> **Promote to Production**.

### Database Schema Rollback
If a migration caused issues:
1. Restore the most recent backup taken prior to migration using `database/backup/restore.sh`:
   ```bash
   ./database/backup/restore.sh backups/assetvault_cloud_YYYYMMDD_HHMMSS.dump
   ```
2. Verify table integrity with `./database/backup/verify-restore.sh`.
