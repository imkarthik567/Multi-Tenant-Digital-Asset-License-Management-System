# AssetVault: Project Schedule & Gantt Chart

**Course:** BCSE307L Database Systems (Fall 2026-27)  
**Project:** AssetVault (Multi-Tenant Digital Asset & License Management System)  

---

## 1. Development Timeline (Mermaid Gantt Chart)

```mermaid
gantt
    title AssetVault Engineering & Delivery Roadmap (Fall 2026-27)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Phase 1: Database Design & Specs
    Requirements & Problem Statement       :done,    p1_1, 2026-08-01, 2026-08-07
    ER Modeling & Cardinality Specs        :done,    p1_2, 2026-08-08, 2026-08-15
    Relational Normalization Proof (3NF)   :done,    p1_3, 2026-08-16, 2026-08-22
    Data Dictionary & Index Strategy       :done,    p1_4, 2026-08-23, 2026-08-28
    SQL DDL, Views & Trigger Scripts       :done,    p1_5, 2026-08-29, 2026-09-04

    section Phase 2: Backend Architecture
    Monorepo Setup & Express Scaffold      :done,    p2_1, 2026-09-05, 2026-09-10
    Prisma Schema & Migrations             :active,  p2_2, 2026-09-11, 2026-09-18
    Auth, Google OAuth & JWT Engine        :         p2_3, 2026-09-19, 2026-09-26
    Asset & License CRUD Services          :         p2_4, 2026-09-27, 2026-10-04
    Seat Allocation & Trigger Enforcement  :         p2_5, 2026-10-05, 2026-10-12
    Audit Logging & Analytics Endpoints    :         p2_6, 2026-10-13, 2026-10-18

    section Phase 3: Frontend Web Application
    Vite + React 18 + Tailwind Setup       :         p3_1, 2026-10-19, 2026-10-24
    Authentication & Organization Layout   :         p3_2, 2026-10-25, 2026-10-30
    Asset Catalog & Metadata Viewer        :         p3_3, 2026-10-31, 2026-11-06
    License Management & Seat Matrix       :         p3_4, 2026-11-07, 2026-11-14
    Audit Trail & System Settings UI       :         p3_5, 2026-11-15, 2026-11-20

    section Phase 4: DevOps & Final Evaluation
    Docker Compose & Containerization      :         p4_1, 2026-11-21, 2026-11-26
    GitHub Actions CI/CD Pipeline          :         p4_2, 2026-11-27, 2026-12-01
    Comprehensive Verification & Testing   :         p4_3, 2026-12-02, 2026-12-06
    Viva Voce Prep & Project Submission    :         p4_4, 2026-12-07, 2026-12-12
```

---

## 2. Work Breakdown Structure (WBS)

| Sprint / Phase | Focus Area | Deliverables | Status |
| :---: | :--- | :--- | :---: |
| **Sprint 1** | Conceptual & Logical DB Design | ER Diagram, Functional Dependency analysis, 3NF mathematical proofs. | Completed |
| **Sprint 2** | Physical DB Design & SQL Programming | DDL schemas, PL/pgSQL triggers, views, RLS policies, indexing scripts. | Completed |
| **Sprint 3** | Backend Foundations & Security | Express app, Zod environment validation, BCrypt, JWT rotation, Google OAuth. | In Progress |
| **Sprint 4** | Core Business Domains | Asset catalog endpoints, License allocation engine, Audit trail capture. | Upcoming |
| **Sprint 5** | Frontend User Experience | Responsive React 18 UI, TanStack Query caching, seat matrix UI. | Upcoming |
| **Sprint 6** | DevOps & Final Review | Multi-container Docker Compose, GitHub Actions CI, Viva notes. | Upcoming |
