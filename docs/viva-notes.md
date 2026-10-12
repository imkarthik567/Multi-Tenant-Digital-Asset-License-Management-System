# AssetVault: DBMS Viva Voce Preparation & Theory Notes

**Course:** BCSE307L Database Systems (Fall 2026-27)  
**Institution:** Vellore Institute of Technology (VIT), Vellore  
**Candidate Name:** Karthikeyan S  
**System:** AssetVault (Multi-Tenant Digital Asset & License Management System)  

---

## 1. Multi-Tenancy Architecture & Isolation Models

### Question 1: What multi-tenancy architecture does AssetVault use, and why?
**Answer:**  
AssetVault employs the **Shared Database, Shared Schema with Row-Level Isolation** pattern.

| Architecture Pattern | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Separate DB per Tenant** | Each tenant has its own isolated database instance. | Absolute physical isolation, easy per-tenant backup. | Massive infrastructure cost, connection pool exhaustion, schema migration nightmare across 1000s of tenants. |
| **Separate Schema per Tenant** | One DB, but each tenant has a distinct PostgreSQL schema namespace. | Logical separation, easier DDL than separate DBs. | PostgreSQL query planner degrades with 10,000+ schemas; complex connection pooling. |
| **Shared DB, Shared Schema (AssetVault)** | All tenants share the same relational tables; every top-level entity is scoped by `tenant_id`. | Maximum cost efficiency, minimal connection overhead, instant tenant provisioning, unified analytics. | Requires strict isolation enforcement (RLS + application scoping) to prevent data leakage. |

---

## 2. Relational Normalization & Functional Dependencies

### Question 2: Why do child tables in AssetVault (e.g. `license_allocations`, `refresh_tokens`) NOT have a `tenant_id` column?
**Answer:**  
To strictly satisfy **Third Normal Form (3NF)**:
- In `license_allocations`, the primary key is `id`.
- The allocation points to a `license_id`.
- Every license in `licenses` already has a `tenant_id`:
  $$\text{license\_id} \rightarrow \text{tenant\_id}$$
- If we duplicated `tenant_id` into `license_allocations`, we would introduce a **transitive functional dependency**:
  $$\text{id} \rightarrow \text{license\_id} \rightarrow \text{tenant\_id}$$
- In 3NF, for any non-trivial FD $X \rightarrow Y$, $X$ must be a superkey or $Y$ must be a prime attribute. Here, $\text{license\_id}$ is not a superkey of `license_allocations`, yet it determines non-prime attribute $\text{tenant\_id}$.
- Duplicating it would also create **update anomalies** (a child row could point to Tenant A while the parent license belongs to Tenant B). Tenancy is safely derived via relational joins.

---

### Question 3: Why are all user roles stored in a single `users` table instead of separate tables for admins, managers, and members?
**Answer:**  
Creating separate `admins` and `students/members` tables is a major relational anti-pattern:
1. **Redundancy:** Violates normalization by replicating identity columns (`email`, `password_hash`, `full_name`, `created_at`) across multiple tables.
2. **Referential Integrity Breakdown:** Foreign keys from `audit_logs` or `license_allocations` to `user_id` would require non-standard polymorphic relationships.
3. **Role Transition:** Promoting a member to an admin would require deleting a row from one table and inserting into another, causing referential cascades and data loss.
In AssetVault, all users live in `users` with a normalized `role_id` foreign key referencing the `roles` lookup table.

---

## 3. Transaction ACID Properties & Concurrency Control

### Question 4: How does AssetVault prevent race conditions during concurrent license seat allocations?
**Answer:**  
When two users concurrently claim the last available seat on a 10-seat license, a race condition can cause an illegal 11th allocation. AssetVault prevents this through two complementary mechanisms:
1. **Database-Level Trigger (`fn_validate_seat_allocation_limit`):** Executed inside the database engine before insertion, locking the table row and calculating active seats. If $\text{active\_seats} + 1 > \text{total\_seats}$, it raises an exception (`check_violation`) and aborts the transaction.
2. **ACID Transaction Isolation:** In PostgreSQL, transactions operate under `READ COMMITTED` by default. For seat assignment, the service wraps allocation queries in a Prisma interactive transaction with row locking (`SELECT FOR UPDATE` on the parent `licenses` row), serializing seat reservations.

---

## 4. PostgreSQL Advanced Features: Triggers, Procedures, and Views

### Question 5: What is the difference between a Stored Procedure and a Stored Function in PostgreSQL 16?
**Answer:**  
- **Function (`CREATE FUNCTION`):** Always returns a value (or `VOID`), can be called inside `SELECT` queries (e.g. `SELECT fn_validate_seat(...)`), but **cannot** execute transaction control statements (`COMMIT` or `ROLLBACK`) inside its body.
- **Procedure (`CREATE PROCEDURE`):** Introduced in PostgreSQL 11, invoked using `CALL sp_name()`, does not return a value (uses `INOUT` parameters if needed), and **can** control transactions internally using explicit `COMMIT` and `ROLLBACK` blocks. Ideal for batch maintenance jobs like `sp_expire_overdue_licenses()`.

---

### Question 6: What is the difference between a Standard View and a Materialized View?
**Answer:**  
- **Standard View (`CREATE VIEW`):** A saved SQL query. Every time the view is queried, PostgreSQL runs the underlying query against the base tables. It consumes no disk storage (besides system catalog metadata) and always returns real-time data.
- **Materialized View (`CREATE MATERIALIZED VIEW`):** Executes the query once and physically writes the result set to disk. Fast for heavy aggregation queries, but data becomes stale until refreshed using `REFRESH MATERIALIZED VIEW [CONCURRENTLY]`. AssetVault uses standard views for real-time seat tracking and audit visibility.

---

## 5. Row-Level Security (RLS) & Session Variables

### Question 7: How does PostgreSQL Row-Level Security (RLS) work in AssetVault?
**Answer:**  
1. RLS is enabled on tables using `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`.
2. A security policy is declared:
   ```sql
   CREATE POLICY tenant_isolation_assets ON assets
   FOR ALL
   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
   ```
3. At the beginning of a database connection/transaction, the application sets the session variable:
   ```sql
   SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
   ```
4. Even if an attacker executes `SELECT * FROM assets;`, PostgreSQL automatically injects the `WHERE tenant_id = ...` filter at the query planner level, preventing data leakage.

---

## 6. Indexing Strategies & Performance Tuning

### Question 8: Explain the purpose of the Partial Unique Index on `license_allocations`.
**Answer:**  
```sql
CREATE UNIQUE INDEX idx_allocations_active_unique 
ON license_allocations(license_id, user_id) 
WHERE revoked_at IS NULL;
```
- A user may have been allocated a license in the past, had it revoked, and later allocated it again (creating multiple rows with `revoked_at IS NOT NULL`).
- A standard unique constraint on `(license_id, user_id)` would prevent re-allocating a seat to that user forever.
- A **Partial Index** indexes only tuples satisfying `WHERE revoked_at IS NULL`. It enforces that a user can have at most **one active seat** at any time while keeping index size minimal.

---

### Question 9: Why did you use a GIN Trigram index on `assets.name` instead of a standard B-tree index?
**Answer:**  
- A standard B-tree index only accelerates prefix queries like `WHERE name LIKE 'Helv%'`. For arbitrary substring searches like `WHERE name ILIKE '%pro%'`, a B-tree must perform a full sequential table scan $O(N)$.
- The `pg_trgm` extension breaks strings into 3-character substrings (trigrams). A Generalized Inverted Index (GIN) on trigrams allows PostgreSQL to perform lightning-fast inverted index lookups for substring and fuzzy matching $O(\log N)$.
