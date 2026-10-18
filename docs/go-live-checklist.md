# AssetVault — Go-Live Checklist
**Review date:** October 18, 2026  
**Scope:** Source and GitHub Actions configuration review for the BCSE307L Database Systems project.

> **This is a checklist, not a production sign-off.** The live PostgreSQL database, hosting accounts, repository collaborator list, external uptime service and browser-based deployment were not independently inspected. Do not mark those items complete based solely on configuration files or historical screenshots/reports.

## 1. Repository and academic requirements

- [x] Repository has `main` and `dev` branches (checked through GitHub branch metadata).
- [x] Repository history contains more than 10 commits and meaningful-looking commit messages.
- [ ] **Make the repository private.** GitHub metadata returned `private=false` / `visibility=public` on October 18, 2026. The rubric requires one private repository.
- [ ] Confirm every project team member is added as a collaborator.
- [ ] Check names, team assignments and registration metadata in the final submitted proposal/report for accuracy.
- [ ] After review, merge the approved draft PR into `main` and confirm `main` and `dev` are in the expected final state.

## 2. Credentials and secrets

- [x] The latest reviewed CI revision passed the repository secret scanner.
- [x] The latest reviewed CI revision passed the SQL-injection static scan.
- [x] Login no longer pre-fills seeded credentials or offers a one-click demo credential picker.
- [ ] Store real, unique values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `METRICS_BEARER_TOKEN` and `APP_DB_PASSWORD` in the appropriate hosting secret stores.
- [ ] Set `DATABASE_URL` to the restricted `assetvault_app` runtime role. Set `DIRECT_URL` to a separate privileged direct connection for migrations and trusted maintenance. Ensure the password in the runtime URL matches `APP_DB_PASSWORD`; URL-encode special characters.
- [ ] Rotate any credentials that were previously used as public demo/default credentials in an actual deployed environment. Removing the default from source does not rotate an already-created account's database password.

## 3. Database, RLS and reporting

- [x] PostgreSQL migrations, custom SQL setup and seeding passed in an earlier run of the current fix branch.
- [x] Reporting views are configured with `security_invoker=true`, and the raw all-tenant monthly access materialization is intended to be revoked from the runtime role.
- [x] Regression tests now cover reporting view options and access boundaries.
- [ ] Confirm the **latest** Actions run passes the privilege/RLS tests after the final grant ordering in `database/sql/04_rls.sql`.
- [ ] Apply migrations to the intended production database and verify all extensions, constraints, views, functions, triggers, privileges and RLS policies against the live catalog.
- [ ] Test tenant A cannot read tenant B rows through base tables, ordinary reporting views and `v_monthly_access_stats_tenant`; verify the runtime role cannot directly select `mv_monthly_access_stats`.
- [ ] Recheck dashboard queries, report filters and stored procedure behavior after the reporting-view changes.

## 4. Application and authentication

- [ ] Run the current browser-level Playwright tests and manually verify desktop/mobile layouts, login/logout, refresh-token rotation, Google OAuth (if enabled), role-based menus/pages/APIs, CRUD, filtering and pagination.
- [ ] For the default Vercel + Render cross-site deployment, set `COOKIE_SAMESITE=none` and confirm the cookie is sent over HTTPS with `Secure` and `HttpOnly`. Same-site/local development can use a stricter policy.
- [ ] Verify the live frontend and API health/readiness routes from a browser and from an external client. Example hostnames in the docs are not proof that the deployed services currently exist or are healthy.
- [ ] Record the actual working frontend URL and API URL for submission; the faculty requirement explicitly asks for a live URL.

## 5. Docker, CI/CD and backup/recovery

- [x] Docker image workflow has succeeded on a prior revision of this branch; the latest revision is still subject to CI verification.
- [ ] Configure `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` in repository Actions secrets, then verify the API and web images are published to the intended Docker Hub repositories.
- [ ] Run `.github/workflows/db-backup.yml` with `DATABASE_DIRECT_URL` (preferred) or `DATABASE_URL` configured and confirm an artifact/checksum is created.
- [ ] Execute a restore to a scratch database and compare table counts/data, not just a successful `pg_dump`.
- [ ] Confirm that backup secrets, runtime credentials and production environment files are not committed.
- [ ] Verify Render deployment and Vercel builds/deployments against their live dashboards; workflow YAML alone is not proof of a working deployment.

## 6. Current CI evidence

- The branch previously completed secret scanning, SQL-injection static scanning, TypeScript/lint checks, migrations and seeding.
- A later CI run passed 137 tests and failed one newly added database privilege test because the custom RLS script re-granted the raw materialized-view permission. The permission revocation has since been moved to the end of `database/sql/04_rls.sql`; the rerun on the newest branch revision is the source of truth.
- The dependency audit previously reported 18 total vulnerabilities, including high-severity development dependency advisories and moderate React Router advisories in the production tree. Do not claim a clean all-dependencies audit until those findings are either fixed or explicitly risk-accepted with evidence.
