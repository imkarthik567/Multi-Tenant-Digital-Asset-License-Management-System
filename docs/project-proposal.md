# AssetVault: Project Proposal & Technical Specification

**Course:** BCSE307L - Database Systems (Fall 2026-27)  
**Institution:** Vellore Institute of Technology (VIT), Vellore  
**Candidate Name:** Karthikeyan S  
**Project Title:** AssetVault: A Multi-Tenant Digital Asset & License Management System  

---

## 1. Executive Summary & Problem Statement

Modern technology and digital media enterprises manage thousands of costly software licenses (IDEs, design suites, proprietary fonts, machine learning corpora, high-resolution media, cloud subscriptions). Organizations face severe operational and financial vulnerabilities:
1. **License Compliance Risk & Financial Penalties:** Software audits by vendors (e.g. Adobe, JetBrains, Microsoft) impose heavy non-compliance penalties if active seat allocations exceed purchased quotas.
2. **Zombie Subscriptions & Cost Inefficiency:** Expired or under-utilized licenses renew automatically, causing budget hemorrhages.
3. **Digital Asset Sprawl:** Mission-critical assets (fonts, datasets, proprietary binaries) are scattered across fragmented storage without cryptographic provenance or access auditing.
4. **Multi-Tenant SaaS Challenge:** Service providers serving multiple client organizations must guarantee zero cross-tenant leakage in a shared database infrastructure while delivering low-latency queries and strict compliance auditing.

**AssetVault** solves these challenges by providing a secure, multi-tenant digital asset and license management platform powered by PostgreSQL 16 and a modern full-stack web architecture.

---

## 2. System Scope & Functional Requirements

### 2.1 Multi-Tenant Organization Management
- Self-contained tenant accounts with customizable slugs, subscription tiers, and branding.
- Zero cross-tenant data leakage guaranteed at both database level (Row-Level Security) and application level.
- Multi-tier role-based access control (Super Admin, Tenant Admin, Asset Manager, Member, Auditor).

### 2.2 Digital Asset Repository
- Unified catalog supporting fonts, images, software binaries, datasets, videos, and documents.
- Granular hierarchical categories and flexible tagging vocabulary.
- Immutable access logging (view, download, checkout) recording client IP and user agent.
- Soft-delete lifecycle protection preventing irreversible data loss.

### 2.3 Software License & Seat Allocation Matrix
- Management of diverse licensing models: per-seat, site, subscription, perpetual, and open-source.
- Real-time seat allocation bounds enforcement preventing seat over-allocation at the database trigger level.
- Expiration date tracking with automated 30-day renewal notification alerts.

### 2.4 Compliance, Governance & Audit Trails
- Comprehensive audit log capturing all `CREATE`, `UPDATE`, `DELETE`, `ALLOCATE`, and `REVOKE` operations.
- State-diff capture storing `old_values` and `new_values` as structured JSONB documents.
- Complete session audit trail using SHA-256 hashed refresh tokens.

---

## 3. Technology Stack & Architectural Justification

| Layer | Selection | Justification |
| :--- | :--- | :--- |
| **Database** | PostgreSQL 16 | ACID transactions, native JSONB, GIN trigram indexing, PL/pgSQL triggers, Row-Level Security (RLS). |
| **ORM / Data Access** | Prisma ORM | Type-safe schema generation, predictable migrations, parameterized queries preventing SQL injection. |
| **Backend API** | Node.js 20+ Express, TypeScript | Non-blocking asynchronous I/O, layered service architecture, Zod schema validation. |
| **Frontend Web** | React 18, Vite, TypeScript, Tailwind CSS | Fast component-based SPA, responsive UI, TanStack Query for server state caching. |
| **Authentication** | Google OAuth 2.0 (Passport.js), BCrypt (cost 12), JWT | Industry-standard stateless auth with 15-minute access tokens and SHA-256 hashed refresh tokens in httpOnly cookies. |
| **DevOps** | Docker, Docker Compose, GitHub Actions | Reproducible multi-container local and CI execution. |

---

## 4. Database Design Highlights
- **Normalized Relational Schema:** All 15 entities engineered in Third Normal Form (3NF).
- **Tenancy Architecture:** Top-level tables carry an indexed `tenant_id`. Child tables inherit tenancy via parent FKs without redundant columns, eliminating transitive dependencies.
- **Advanced SQL Objects:** Pre-computed relational views, PL/pgSQL stored procedures for renewal alerts, and database-level seat capacity enforcement triggers.
- **Indexing Strategy:** B-tree foreign key indexing, partial unique indexes for active seat allocations, and GIN trigram indexes for text search.
