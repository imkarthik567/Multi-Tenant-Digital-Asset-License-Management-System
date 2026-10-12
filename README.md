# AssetVault: Multi-Tenant Digital Asset & License Management System

[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?logo=postgresql)](https://www.postgresql.org/)
[![ORM: Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![Backend: Node.js Express](https://img.shields.io/badge/Backend-Node.js%20Express-68A063?logo=node.js)](https://nodejs.org/)
[![Frontend: React 18](https://img.shields.io/badge/Frontend-React%2018%20+%20Vite-61DAFB?logo=react)](https://react.dev/)
[![Styling: Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: Academic](https://img.shields.io/badge/License-Academic%20(VIT)-blue.svg)](#)

---

## Course Information
* **Institution:** Vellore Institute of Technology (VIT)
* **Course:** BCSE307L - Database Systems (Fall 2026-27)
* **Student Name:** Karthikeyan S
* **Project Name:** AssetVault

---

## 1. Executive Summary

**AssetVault** is an enterprise-grade multi-tenant Software-as-a-Service (SaaS) platform built for organizations to securely manage their digital assets (fonts, brand images, software binaries, datasets, documentation, videos) alongside commercial and open-source licenses, vendors, seat allocations, compliance audits, and lifecycle renewals.

### Core Architectural Guarantees
1. **Zero Cross-Tenant Leakage:** Rigid tenant isolation enforced through foreign-key tenant scoping and database-level Row-Level Security (RLS) policies.
2. **Third Normal Form (3NF):** Formally normalized schema eliminating transitive dependencies and redundant attributes. Top-level tenant tables hold `tenant_id`, while child tables inherit tenant context strictly via parent foreign keys.
3. **Advanced DBMS Capabilities:** Includes PostgreSQL 16 stored functions, procedures, row-level audit triggers, seat limit enforcement triggers, database views, and GIN/trigram full-text indexes.
4. **Hardened Security Architecture:** Password hashing with BCrypt (cost factor 12), SHA-256 hashed refresh tokens stored in database, 15-minute JWT access tokens, Google OAuth 2.0 via Passport.js, Helmet, rate-limiting, and Zod environment validation.

---

## 2. Monorepo Structure

```text
.
├── apps/
│   ├── api/                     # Node.js 20+ Express + TypeScript + Prisma backend
│   └── web/                     # React 18 + Vite + TypeScript + Tailwind frontend
├── database/
│   ├── er-diagram.md            # Formal ER Diagram with cardinality & design rationale
│   ├── normalization.md         # 1NF, 2NF, 3NF, BCNF proofs and dependencies
│   ├── data-dictionary.md       # Full schema data dictionary & index rationale
│   └── scripts/                 # DDL, Views, Procedures, Triggers, RLS, Indexes, Seed
│       ├── 01_schema.sql
│       ├── 02_views.sql
│       ├── 03_procedures_triggers.sql
│       ├── 04_rls.sql
│       ├── 05_indexes.sql
│       ├── 06_seed.sql
│       └── 07_backup_restore.sh
├── docs/
│   ├── project-proposal.md      # Course project proposal & requirements specification
│   ├── gantt-chart.md           # Project schedule & work breakdown structure
│   └── viva-notes.md            # Comprehensive oral exam / viva voce preparation notes
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated CI pipeline for linting, build, and tests
├── docker-compose.yml           # Unified orchestration for PostgreSQL 16, API, and Web
├── .env.example                 # Root environment template
└── package.json                 # Monorepo workspaces definition
```

---

## 3. Quickstart & Local Development

### Prerequisites
* **Node.js:** v20.0.0 or higher
* **npm:** v10.0.0 or higher
* **PostgreSQL:** v16 (or Docker Desktop)

### Option A: Running via Docker Compose (Recommended)
```bash
# Start PostgreSQL 16, Express API, and React Web
docker-compose up --build
```
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Database: `localhost:5432` (`assetvault_db`)

### Option B: Running Locally with Node.js
```bash
# 1. Install root dependencies and workspaces
npm install

# 2. Configure environment files
cp .env.example apps/api/.env
# Edit apps/api/.env with your PostgreSQL credentials

# 3. Setup and seed the database
cd apps/api
npx prisma db push
npx prisma db seed
cd ../..

# 4. Run both apps concurrently
npm run dev
```

---

## 4. Academic Grading Rubric Alignment (BCSE307L)

| Rubric Component | AssetVault Implementation | Relevant Files |
| :--- | :--- | :--- |
| **Relational Schema & ER Design** | 15 tables, UUID keys, strict integrity constraints (`CHECK`, `UNIQUE`, `NOT NULL`, `DEFAULT`), composite FKs. | `/database/er-diagram.md`, `/database/scripts/01_schema.sql` |
| **Database Normalization** | Strict 3NF proof, child table tenancy inheritance avoiding redundant columns. | `/database/normalization.md` |
| **Data Dictionary & Indexing** | Comprehensive column glossary, B-tree, GIN/Trigram text search indexes with execution plan rationales. | `/database/data-dictionary.md`, `/database/scripts/05_indexes.sql` |
| **Advanced SQL Objects** | Relational views, stored procedures for renewal alerts, triggers for seat limits and audit logging. | `/database/scripts/02_views.sql`, `/database/scripts/03_procedures_triggers.sql` |
| **Security & Multi-Tenancy** | PostgreSQL Row-Level Security (RLS) policies, BCrypt (cost 12), SHA-256 tokens, Google OAuth 2.0. | `/database/scripts/04_rls.sql`, `/apps/api/src/modules/auth/` |
| **Application & Architecture** | Layered Express + Prisma architecture, React 18 + TanStack Query UI, Docker Compose, CI/CD. | `/apps/api/`, `/apps/web/`, `docker-compose.yml` |
| **Documentation & Viva Prep** | Formal proposal, Gantt chart, ER diagrams, viva questions with ACID/RLS answers. | `/docs/project-proposal.md`, `/docs/viva-notes.md` |
