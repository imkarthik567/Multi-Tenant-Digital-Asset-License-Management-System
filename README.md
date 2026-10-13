# AssetVault: Multi-Tenant Digital Asset & License Management System

[![CI Pipeline](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions/workflows/ci.yml/badge.svg)](https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System/actions)
[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![Deploy to Vercel](https://img.shields.io/badge/Deploy%20to-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Monitoring: Prometheus & Grafana](https://img.shields.io/badge/Monitoring-Prometheus%20%2B%20Grafana-F46800?logo=grafana&logoColor=white)](#)
[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?logo=postgresql)](https://www.postgresql.org/)
[![ORM: Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![Backend: Express TypeScript](https://img.shields.io/badge/Backend-Node.js%2020%20+%20Express-68A063?logo=node.js)](https://nodejs.org/)
[![Frontend: React 18](https://img.shields.io/badge/Frontend-React%2018%20+%20Vite-61DAFB?logo=react)](https://react.dev/)
[![Docker: Multi--Stage](https://img.shields.io/badge/Docker-Alpine%20Multi--Stage-2496ED?logo=docker)](https://www.docker.com/)
[![License: Academic](https://img.shields.io/badge/License-Academic%20(VIT)-blue.svg)](#)

---

## Course Information
* **Institution:** Vellore Institute of Technology (VIT), Vellore
* **Course:** BCSE307L — Database Systems (Fall 2026-27)
* **Author / Lead Architect:** Karthikeyan S (Registration No. 24MCA0000)
* **Project Repository:** `AssetVault`

---

## 1. Executive Summary

**AssetVault** is an enterprise-grade multi-tenant Software-as-a-Service (SaaS) platform built for organizations to govern digital assets (fonts, brand collateral, binaries, datasets, media) alongside commercial and open-source licenses, software suppliers, seat allocations, compliance audits, and renewal lifecycles. Engineered strictly around Third Normal Form (3NF) relational principles, AssetVault guarantees absolute tenant data isolation through PostgreSQL 16 Row-Level Security (RLS) policies, session configuration contexts, and ACID-compliant transaction procedures.

---

## 2. Key Features

* **Rigid Multi-Tenancy & Row-Level Security (RLS):** True shared-database, shared-schema tenancy with zero cross-tenant leakage enforced by database-level security policies (`app.current_tenant_id`).
* **Role-Based Access Control (RBAC):** Hierarchical governance across 4 seeded roles: `SUPER_ADMIN` (Platform Governance), `TENANT_ADMIN` (Organization Governance), `ASSET_MANAGER` (Asset & Contract Operations), and `MEMBER` (Self-Service Seat Checkout).
* **License Seat Capacity Management:** Atomic seat allocation and release governed by stored procedures `sp_allocate_license_seat` and `sp_release_license_seat` preventing race conditions and over-allocation.
* **Immutable Compliance Audit Ledger:** Append-only change log enforced by database triggers (`trg_audit_logs_append_only`) with JSON diff tracking and RFC 4180 CSV export.
* **Automated Expiry & Background Schedulers:** Idempotent background worker (`worker.ts`) using PostgreSQL advisory locks (`pg_try_advisory_lock`), auto-renewing terms via `sp_renew_license` and dispatching alerts via `fn_generate_expiry_notifications`.
* **Real-Time Push Alerts & Email Dispatch:** Server-Sent Events (SSE) notification streaming (`GET /api/notifications/stream`) paired with asynchronous transactional email notifications via Nodemailer.
* **Cost Optimisation & Inactive Seat Reclaim:** Discovers dormant seat allocations (>30 days inactive) and provides one-click seat reclamation to reduce unnecessary SaaS spend.
* **Global Fuzzy Search (`Ctrl+K`):** Blazing-fast trigram multi-entity search powered by the PostgreSQL `pg_trgm` extension and GIN indexes.

---

## 3. System Architecture & Multi-Tenancy

```mermaid
flowchart TD
    User([User Browser / Mobile]) -->|Port 8080| Web[Nginx Web Server]
    Web -->|Static Assets & SPA Routing| ReactApp[React 18 SPA]
    Web -->|Reverse Proxy /api/| ExpressAPI[Express REST API :5000]

    subgraph Express Application Layer
        ExpressAPI --> AuthMW[JWT & Session Middleware]
        AuthMW --> TenantMW[Tenant Context Middleware]
        TenantMW -->|SET LOCAL app.current_tenant_id| PrismaClient[Prisma ORM Client]
        TenantMW --> StreamService[SSE Notification Broadcaster]
    end

    subgraph Database Layer: PostgreSQL 16
        PrismaClient --> RLS[Row-Level Security Policies]
        RLS --> Tables[(19 Relational Base Tables)]
        Tables --> Triggers[Audit & Quota Triggers]
        Tables --> Views[Materialized & SQL Views]
        Tables --> StoredProcs[ACID Stored Procedures]
    end

    subgraph Background Worker
        CronWorker[Node-Cron Worker Process] -->|Advisory Locks 1001-1003| StoredProcs
        CronWorker --> EmailService[Nodemailer SMTP Queue]
    end
```

### Multi-Tenancy Implementation
AssetVault adopts a **Pooled Schema Multi-Tenant Model**:
1. All organizations share a unified database and schema.
2. Every top-level entity stores a foreign key `tenant_id` linked to `tenants(id)`.
3. Every database connection sets a transaction-scoped session variable:
   ```sql
   SET LOCAL app.current_tenant_id = 'c1a7e930-b452-47df-bc6a-8d1e2e9c2f10';
   ```
4. PostgreSQL Row-Level Security (RLS) policies transparently filter every `SELECT`, `INSERT`, `UPDATE`, and `DELETE` at the database kernel level:
   ```sql
   CREATE POLICY tenant_isolation_policy ON assets
       FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
   ```

---

## 4. Technology Stack

| Layer | Technologies | Rationale |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS, TanStack Query v5, Recharts, Lucide Icons | Responsive enterprise UI with in-memory JWT storage, dark mode, accessible components, and instant cached mutations. |
| **Backend API** | Node.js 20 LTS, Express, TypeScript, Prisma ORM, Zod, Nodemailer, PDFKit | High-throughput async REST API with Zod schema validation, structured Pino logging, and Prometheus metrics. |
| **Database** | PostgreSQL 16 / 18, PL/pgSQL, `pg_trgm` | Strict 3NF relational engine with ACID stored procedures, advisory locks, and materialized views. |
| **DevOps & Containers**| Docker, Docker Compose, Nginx Alpine, GitHub Actions, Husky, Commitlint | Multi-stage minimal footprint containers (<185 MB API, <48 MB Web), automated CI/CD, and pre-commit secret gates. |

---

## 5. Database Design Summary

* **ER Diagram:** [`database/er-diagram.md`](database/er-diagram.md) | Vector Graphic: [`database/er-diagram.svg`](database/er-diagram.svg)
* **Data Dictionary:** [`database/data-dictionary.md`](database/data-dictionary.md)
* **Relational Schema:** [`database/relational-schema.md`](database/relational-schema.md)
* **Normalization Proofs:** [`database/normalization.md`](database/normalization.md)

### Database Object Inventory
* **19 Relational Base Tables:** `tenants`, `plans`, `users`, `roles`, `refresh_tokens`, `categories`, `tags`, `vendors`, `assets`, `asset_versions`, `asset_tags`, `license_types`, `licenses`, `asset_licenses`, `license_allocations`, `license_renewals`, `asset_access_logs`, `audit_logs`, `notifications`.
* **8 Relational & Materialized Views:** `v_asset_catalog`, `v_license_utilization`, `v_expiring_licenses`, `v_vendor_spend`, `v_monthly_spend`, `v_top_downloaded_assets`, `v_tenant_summary`, and `mv_monthly_access_stats`.
* **5 Stored Procedures:** `sp_allocate_license_seat`, `sp_release_license_seat`, `sp_renew_license`, `sp_soft_delete_asset`, `sp_restore_asset`.
* **8 PL/pgSQL Functions:** `fn_generate_expiry_notifications`, `fn_tenant_dashboard_stats`, `fn_audit_trail_logger`, `fn_enforce_license_seat_cap`, `fn_enforce_plan_asset_limit`, `fn_check_category_cycle`, `fn_refresh_access_stats`, `fn_enforce_audit_append_only`.
* **7 Row-Level Triggers:** Append-only audit trigger, seat capacity quota trigger, plan limit trigger, category acyclic validation trigger, and automatic timestamps.

---

## 6. Prerequisites

* **Node.js:** v20.0.0 or higher
* **npm:** v10.0.0 or higher
* **PostgreSQL:** v16 or v18 (or Docker Desktop)
* **Git:** v2.30.0 or higher

---

## 7. Installation & Setup

### Step 1: Clone Repository
```bash
git clone https://github.com/imkarthik567/Multi-Tenant-Digital-Asset-License-Management-System.git assetvault
cd assetvault
```

### Step 2: Configure Environment Files
Copy the template files into active environment files:
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### Step 3: Generate Cryptographic Secrets
Generate random 32-byte hexadecimal strings for JWT tokens and cookie signing:
```bash
# Generate 3 random secrets on Linux/macOS
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32

# On Windows PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Paste these into `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` inside `.env` and `apps/api/.env`.

### Step 4: Configure Google OAuth 2.0 (Optional for Local Testing)
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new OAuth 2.0 Client ID under **APIs & Services > Credentials**.
3. Set **Authorized redirect URIs** to `http://localhost:5000/api/auth/google/callback`.
4. Copy the Client ID and Secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Step 5: Database Schema Initialization & Seeding
```bash
# Install dependencies
npm install

# Push relational schema to PostgreSQL
npx prisma db push --schema apps/api/prisma/schema.prisma

# Seed baseline plans, enterprise tenants, categories, assets, and licenses
node node_modules/ts-node/dist/bin.js apps/api/prisma/seed.ts
```

---

## 8. Execution & Run Modes

### Option A: Local Development Mode
```bash
# Concurrently launches Express API (port 5000) and Vite React Frontend (port 5173)
npm run dev
```
* **Web Client:** `http://localhost:5173`
* **REST API:** `http://localhost:5000`
* **Swagger API Docs:** `http://localhost:5000/api/docs`

### Option B: Production Full-Stack Docker Deployment
```bash
# Build and launch all 5 containers (db, api, worker, web, pgadmin)
docker compose up --build -d

# Check container health status
docker compose ps
```
* **Web Application (Nginx SPA):** `http://localhost:8080`
* **REST API & Health:** `http://localhost:5000/api/health`
* **PgAdmin Database GUI:** `http://localhost:5050` (Profile: `tools`)

### Option C: Automated Testing Suites
```bash
# 1. Static Analysis & Type Checking
npm run lint

# 2. Secret Hygiene Pre-Scan
npm run check:secrets

# 3. Vitest Unit & Integration Tests (81 Tests, >=70% Service Coverage)
npm run test

# 4. Playwright End-to-End User Journeys (3 Full E2E Flows)
npm run test:e2e
```

### Option D: Database Backup & Restoration Pipeline
```bash
# 1. Take timestamped dual backup (-Fc and -Fp) with SHA-256 checksum and 7-day retention
npm run db:backup

# 2. Run verification drill (restores into scratch DB and validates 19-table row parity)
npm run db:verify-restore

# 3. Restore backup into live database
npm run db:restore -- -y
```

---

## 9. Seeded Demo Accounts

All demo accounts are initialized during `prisma/seed.ts`. Default password: `Password123!` (or value of `DEFAULT_SEED_PASSWORD` in `.env`).

| Email Address | Role | Tenant Organization | Capabilities |
|---|---|---|---|
| `superadmin@assetvault.internal` | `SUPER_ADMIN` | Global Platform | Cross-tenant metrics, manage subscription plans, suspend/activate tenants. |
| `techcorp.admin@techcorp.io` | `TENANT_ADMIN` | TechCorp Dynamics | Manage team members, review audit ledger, compliance score remediation, JSON export. |
| `techcorp.manager@techcorp.io` | `ASSET_MANAGER` | TechCorp Dynamics | Create/edit assets, upload new versions, provision licenses, allocate seats. |
| `techcorp.member1@techcorp.io` | `MEMBER` | TechCorp Dynamics | Browse asset catalog, download covered assets, view self-assigned license seats. |
| `innovatelabs.admin@innovatelabs.com` | `TENANT_ADMIN` | InnovateLabs Inc | Isolated second tenant for cross-tenant boundary verification tests. |

---

## 10. Environment Variable Reference

| Variable Name | Description | Default / Example |
|---|---|---|
| `PORT` | HTTP Port for Express REST API | `5000` |
| `NODE_ENV` | Application environment mode | `development` / `production` |
| `DATABASE_URL` | PostgreSQL connection string with public schema | `postgresql://user:pass@localhost:5432/assetvault_db?schema=public` |
| `POSTGRES_USER` | PostgreSQL superuser username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password | `postgrespassword` |
| `POSTGRES_DB` | Target PostgreSQL database name | `assetvault_db` |
| `JWT_ACCESS_SECRET` | 32+ byte cryptographic secret for access tokens | *(Random Hex String)* |
| `JWT_REFRESH_SECRET` | 32+ byte cryptographic secret for refresh tokens | *(Random Hex String)* |
| `JWT_ACCESS_EXPIRES_IN`| Lifespan of short-lived access JWT | `15m` |
| `JWT_REFRESH_EXPIRES_IN`| Lifespan of rotating refresh token | `7d` |
| `COOKIE_SECRET` | Secret used for signing HTTP-only cookies | *(Random Hex String)* |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth Client ID | `*.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth Client Secret | *(Secret String)* |
| `GOOGLE_CALLBACK_URL` | OAuth redirect endpoint | `http://localhost:5000/api/auth/google/callback` |
| `CLIENT_URL` | Allowed client origin for CORS policies | `http://localhost:5173` |
| `VITE_API_URL` | Backend URL for Vite frontend client proxy | `http://localhost:5000` |
| `RUN_WORKER` | Enables background cron scheduler | `true` |
| `METRICS_BEARER_TOKEN` | Bearer token protecting Prometheus `/metrics` | `dev-metrics-token-assetvault` |

---

## 11. API Documentation & Live Endpoints

* **Interactive OpenAPI Swagger Docs:** `http://localhost:5000/api/docs`
* **OpenAPI 3.0 JSON Specification:** `http://localhost:5000/api/docs.json`
* **Health & Liveness Probe:** `http://localhost:5000/api/health`
* **Database Readiness Probe:** `http://localhost:5000/api/ready`
* **Prometheus Metrics:** `http://localhost:5000/metrics`
* **Docker Hub Registry:**
  * API: `docker pull <DOCKERHUB_USERNAME>/assetvault-api:1.0.0`
  * Web: `docker pull <DOCKERHUB_USERNAME>/assetvault-web:1.0.0`

---

## 12. Free-Cloud Deployment & Operations

AssetVault is engineered for full-stack, free-tier cloud deployment:
* **Cloud Database:** [Supabase](https://supabase.com) (PostgreSQL 16 with Transaction Pooler & Direct URL).
* **Backend API & Cron:** [Render](https://render.com) (Docker Web Service via `render.yaml` Blueprint).
* **Frontend SPA:** [Vercel](https://vercel.com) (Vite React deployment with `/api/*` reverse-proxy rewrites).
* **Automated CI/CD:** GitHub Actions workflows for continuous integration, Docker image publishing, Trivy scanning, automated deployments, free-tier keepalive pinging, and nightly database backups.
* **Telemetry & Monitoring:** Prometheus scraper + Grafana dashboards running locally via `docker compose --profile monitoring up -d`, plus external uptime monitoring via UptimeRobot.

Comprehensive deployment guides:
* [Production Deployment Guide (Supabase, Render, Vercel)](docs/deployment.md)
* [Custom Domain, Dynamic DNS (DuckDNS) & SSL Setup](docs/custom-domain.md)
* [Production Go-Live Verification Checklist](docs/go-live-checklist.md)

### Launching Local Monitoring Stack (Prometheus + Grafana)
```bash
# Start API, Web, DB, Prometheus, and Grafana
docker compose --profile monitoring up -d

# Access Grafana Dashboard (admin / admin):
# http://localhost:3001
# Pre-provisioned dashboard: "AssetVault Enterprise Operations & Telemetry"
```

---

## 13. Monorepo Project Structure

```text
.
├── apps/
│   ├── api/                             # Node.js 20 Express TypeScript Backend
│   │   ├── prisma/                      # Schema definition, migrations, and seed scripts
│   │   ├── src/
│   │   │   ├── config/                  # DB, logger, swagger, and environment configs
│   │   │   ├── controllers/             # HTTP controller handlers
│   │   │   ├── middleware/              # Auth, RLS context, RBAC gates, and observability
│   │   │   ├── routes/                  # Express REST route endpoints
│   │   │   ├── services/                # Business logic, compliance engine, and exports
│   │   │   ├── repositories/            # Data access projection layer
│   │   │   ├── utils/                   # Token, password, and error utilities
│   │   │   ├── worker.ts                # Standalone background cron job worker
│   │   │   └── server.ts                # Primary API entrypoint
│   │   ├── Dockerfile                   # Multi-stage production API image
│   │   └── docker-entrypoint.sh         # Migration execution container entrypoint
│   └── web/                             # React 18 + Vite + Tailwind CSS Frontend
│       ├── src/
│       │   ├── components/              # Layout, common widgets, and CommandPalette (Ctrl+K)
│       │   ├── context/                 # AuthContext, ThemeContext, ToastContext
│       │   ├── pages/                   # Role-aware dashboard, assets, licenses, reports
│       │   └── services/api.ts          # Axios interceptor with silent 401 refresh queue
│       ├── nginx.conf                   # Production Nginx reverse-proxy and SPA routing
│       ├── vercel.json                  # Vercel SPA rewrites & security headers
│       └── Dockerfile                   # Multi-stage Vite build + Nginx Alpine
├── database/
│   ├── backup/                          # Native backup, restore, and verify-restore scripts
│   │   ├── backup.ps1 / backup.sh       # Custom -Fc & -Fp dump with SHA-256 and 7-day retention
│   │   ├── restore.ps1 / restore.sh     # Checksum verification & scratch restore
│   │   └── verify-restore.ps1 / .sh     # Automated 19-table row parity audit table
│   └── sql/                             # Schema DDL, views, triggers, and procedures
│       └── 08_production_bootstrap.sql  # Restricted assetvault_app role provisioning
├── monitoring/                          # Operational telemetry and dashboard configurations
│   ├── prometheus/                      # Scrape config with Bearer token authentication
│   └── grafana/                         # Datasource and dashboard provisioning
├── docs/                                # Technical reports and verification evidence
│   ├── FINAL_AUDIT.md                   # Strict requirement-by-requirement course brief audit (100% PASS)
│   ├── FINAL_REPORT.md                  # Comprehensive academic project report (15 sections, BCNF proofs)
│   ├── DEMO_SCRIPT.md                   # 10-minute viva presentation and demo cue cards
│   ├── VIVA_QA.md                       # 40 project-specific viva questions and detailed technical answers
│   ├── security-test-report.md          # Adversarial penetration test report (22/22 break-it tests passing)
│   ├── deployment.md                    # Free cloud deployment (Supabase, Render, Vercel)
│   ├── custom-domain.md                 # DuckDNS, SSL, CORS & OAuth configuration
│   ├── go-live-checklist.md             # Production sign-off audit checklist
│   ├── advanced-features.md             # 11 Advanced SaaS capabilities breakdown
│   ├── backup-recovery.md               # Real disaster recovery drill terminal evidence
│   ├── docker.md                        # Container build, size reduction, and push steps
│   ├── performance-optimisation.md      # N+1 removal, cursor pagination, and MV benchmarks
│   ├── frontend.md                      # Frontend design tokens, RBAC matrix, and routes
│   └── screenshots/                     # 16 Headless viewport verification screenshots
├── tests/
│   └── e2e/                             # Playwright automated user journey test suite
├── render.yaml                          # Render Blueprint infrastructure as code
├── docker-compose.yml                   # Container orchestration (core + monitoring)
├── docker-compose.prod.yml              # Production overrides with resource limits
├── .github/                             # CI, Docker, Deploy, Keepalive, and Backup workflows
└── package.json                         # Monorepo workspaces definition
```

---

## 14. Visual Verification & Screenshots

Screenshots captured across Desktop ($1280\text{px}$), Tablet ($768\text{px}$), and Mobile ($375\text{px}$) viewports:

| Executive Dashboard (Dark Theme) | Digital Asset Catalog |
|:---:|:---:|
| ![Admin Dashboard](docs/screenshots/03_admin_dashboard_desktop_1280px.png) | ![Asset Catalog](docs/screenshots/04_assets_catalog_desktop_1280px.png) |
| **Software License Matrix** | **Compliance Audit Trail** |
| ![Licenses Matrix](docs/screenshots/06_licenses_catalog_desktop_1280px.png) | ![Audit Logs](docs/screenshots/12_audit_logs_desktop_1280px.png) |

---

## 15. Academic Team & Acknowledgements

* **Lead Architect & Developer:** Karthikeyan S (Department of Computer Applications, VIT Vellore).
* **Course Faculty:** Course Coordinator & Lab Faculty for BCSE307L (Database Systems).
* **Academic License:** Vellore Institute of Technology (Fall 2026-27). Distributed for educational and academic assessment purposes.
