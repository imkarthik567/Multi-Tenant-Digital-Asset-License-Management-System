# Database Systems Project Rubric Compliance

**Course:** BCSE307L — Database Systems, Fall 2026–2027  
**Reference:** Faculty-provided Project Requirement PDF  
**Review basis:** Source-level review of the repository. This checklist must be rechecked after the proposed branch is merged and after runtime verification.

> **Important:** “Present in source” does not mean “verified running.” No production database query, full local Docker start, backup recovery, or browser-based end-to-end run was performed during this source review.

## Rubric status

| PDF section | Marks | Repository evidence | Status now | Remaining acceptance evidence |
|---|---:|---|---|---|
| 1. Problem statement & project planning | 2 | [Project proposal](PROJECT_PROPOSAL.md): title, problem, objectives, scope, team roles, stack, deliverables and Mermaid Gantt | Present in documents | Reconcile author/team identifiers and ensure the final submitted team data is correct. |
| 2. Database design | 6 | [ER diagram](../database/er-diagram.md), [relational schema](../database/relational-schema.md), [data dictionary](../database/data-dictionary.md), [normalization notes](../database/normalization.md); Prisma schema declares 19 models | Strong source evidence | Independently compare every ER entity to the implemented schema; validate PK/FK, constraints, indexes and 3NF claims against a fresh PostgreSQL database. |
| 3. Database implementation | 8 | [Prisma schema and migrations](../backend/prisma/), [views](../database/sql/01_views.sql), [procedures/functions](../database/sql/02_functions_procedures.sql), [triggers](../database/sql/03_triggers.sql), RLS policies and repositories/services | Implemented in source; execution still needs verification | Run migrations and custom SQL from a clean database; exercise CRUD, joins, aggregates, views, transactions and stored procedures; verify RLS and constraints; retain successful test output. |
| 4. Application development | 4 | React routes/pages, login, dashboard, CRUD screens, search/filter components, pagination, Zod validation, API error handling and responsive styles | Present in source | Run the app and verify user journeys, mobile/tablet layouts, invalid-form behavior, filtering, pagination and API error handling. |
| 5. Authentication, authorization & security | 5 | JWT auth, optional Google OAuth, BCrypt helpers, a unified users table with role IDs, permission middleware, secrets validation and database RLS | Implemented in source; production setup must be verified | Confirm production uses the restricted `assetvault_app` URL for `DATABASE_URL` and real secrets are set. **Current caveat:** the Render blueprint also starts the scheduled worker in the API process and passes it `DIRECT_URL`, so the long-lived public API process retains privileged credentials. For strict least privilege, split the worker/maintenance role into a separate service. Test tenant isolation, role denial, logout/refresh and password flows. |
| 6. Professional development practices | 5 | GitHub history, `main`/`dev` branches, `.gitignore`, Docker files, backup/restore scripts, GitHub Actions and Render/Vercel configuration | Partial / action required | Make the repository private; confirm all team members are collaborators; run and retain CI evidence; verify Docker Hub artifacts, live URLs, Docker startup and a restore drill. |

## Mandatory gates that need a human or live environment

- [ ] **Private repository:** GitHub repository metadata was checked on October 18, 2026 and returned `private=false` / `visibility=public`. Change visibility through GitHub **Settings → General → Danger Zone → Change repository visibility → Make private**. This cannot be fixed by editing source files.
- [ ] **Collaborators:** Confirm every team member who needs to review or submit the work has repository access.
- [ ] **Branch/commit requirements:** Verify `main` and `dev` and at least 10 meaningful commits remain visible after final changes. Pull requests are recommended by the PDF.
- [ ] **Docker Hub:** Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` as repository Actions secrets. The workflow now fails non-PR publication if they are missing; the latest draft-branch Docker workflow built images and passed Trivy scans; Docker Hub login/push steps were skipped for the pull-request event. Confirm both API and web images are published to the expected Docker Hub repositories after merge or an authorized non-PR run.
- [ ] **Runtime database security:** Set `DATABASE_URL` to the restricted `assetvault_app` role and `DIRECT_URL` to a privileged direct connection. Set `APP_DB_PASSWORD` to a separate random value with at least 32 characters. Special characters in URL credentials must be URL-encoded.
- [ ] **Live deployment:** Record the real frontend URL and API health/readiness URL in the README or submission. Workflow configuration alone is not proof that the app is currently reachable.
- [ ] **Backup/recovery:** Configure `DATABASE_DIRECT_URL` or `DATABASE_URL` in GitHub Actions secrets, run the backup workflow, then verify a scratch restore and row-count checks.
- [ ] **End-to-end UI:** Run Playwright journeys and manually verify responsive UI, CRUD, authentication and role-based pages in the browser.
- [ ] **Academic metadata:** Review the proposal/report/README author and team details for accuracy and consistency before submitting.

## Bonus marks (up to +3)

| Bonus requirement | Source evidence | Current state |
|---|---|---|
| CI/CD pipeline (+1) | `.github/workflows/ci.yml`, `docker-publish.yml`, `deploy.yml` | Configured; latest code verification passed (173/173 tests across 11 files), and Docker build/Trivy scans passed; Docker Hub publishing was skipped for the pull-request event; live deployment remains a separate check. |
| Custom domain (+1) | [Custom-domain guide](custom-domain.md) | Guide exists; live domain and HTTPS are not verified. |
| Additional industry practice (+1) | RLS, audit logging, automated tests, Prometheus/Grafana configuration, backup/restore tooling | Several practices are implemented in source; runtime evidence is still required. |

## Changes prepared on the rubric-fix branch

This branch updates production database bootstrap, configures the restricted application connection, removes shared passwords from seed/login paths, aligns Docker Hub publishing with production Compose image tags, hardens reporting-view access, corrects vendor spend aggregation, pins scheduled advisory locks to a transaction, makes restore failures propagate, makes the nightly backup workflow fail if credentials are missing, prevents shrinking license seat capacity below active allocations, and validates license, tenant, plan, and asset version inputs, expiry-check day counts, safe file-size precision, strict shared pagination parsing, and report tenant ID validation. Latest CI on commit 9c99e100 passed 159/159 tests across 11 files; Docker build and Trivy scans also passed. Docker Hub publishing was skipped because this was a pull request. Live hosting/database setup, backup restore, collaborators and repository privacy still need human verification before final acceptance.
