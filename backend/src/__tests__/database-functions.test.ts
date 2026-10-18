// ==============================================================================
// AssetVault: Database Functions, Procedures, Triggers & RLS Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Verifies:
//   1. Single audit log row on seat allocation & release (no duplicate audit logs)
//   2. Revocation reason captured in session context and appended to notes
//   3. Stored procedures (sp_allocate_license_seat, sp_release_license_seat, sp_renew_license)
//   4. Declarative check constraints (11 bounds) and GIN trigram indexes
//   5. Triggers (audit immutability, cross-tenant isolation, seat limits)
//   6. PostgreSQL analytical views and materialized view refresh
//   7. Row-Level Security (FORCE RLS) policies under tenant session context
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, prismaForRequest } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { costOptimizationService } from '../services/costOptimization.service';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('AssetVault Database Functions, Stored Procedures & Live Schema Verification', () => {
  let tenantAId: string;
  let tenantBId: string;
  let userAAdminId: string;
  let userAMemberId: string;
  let userBMemberId: string;
  let vendorAId: string;
  let vendorBId: string;
  let testLicenseId: string;
  let testLicenseKey: string;

  beforeAll(async () => {
    // 1. Fetch TechCorp (Tenant A)
    const tenantA = await systemPrisma.tenant.findUnique({ where: { slug: 'techcorp' } });
    expect(tenantA).toBeDefined();
    tenantAId = tenantA!.id;

    // 2. Fetch InnovateLabs (Tenant B)
    const tenantB = await systemPrisma.tenant.findUnique({ where: { slug: 'innovatelabs' } });
    expect(tenantB).toBeDefined();
    tenantBId = tenantB!.id;

    // 3. Fetch Users
    const userAAdmin = await systemPrisma.user.findFirst({
      where: { tenantId: tenantAId, email: { contains: 'admin' } },
    });
    userAAdminId = userAAdmin!.id;

    const userAMember = await systemPrisma.user.findFirst({
      where: { tenantId: tenantAId, email: { contains: 'dev' } },
    });
    userAMemberId = userAMember!.id;

    const userBMember = await systemPrisma.user.findFirst({
      where: { tenantId: tenantBId, email: { contains: 'dev' } },
    });
    userBMemberId = userBMember!.id;

    // 4. Fetch Vendors
    const vendorA = await systemPrisma.vendor.findFirst({ where: { tenantId: tenantAId } });
    vendorAId = vendorA!.id;

    const vendorB = await systemPrisma.vendor.findFirst({ where: { tenantId: tenantBId } });
    vendorBId = vendorB!.id;

    // 5. Create a dedicated isolated test license for stored procedure verification
    testLicenseKey = `TEST-SP-${Date.now()}`;
    const testLicense = await systemPrisma.license.create({
      data: {
        tenantId: tenantAId,
        vendorId: vendorAId,
        licenseTypeId: 3, // SEAT_BASED
        name: 'SP Audit Verification Suite License',
        licenseKey: testLicenseKey,
        totalSeats: 2,
        cost: 150.0,
        currency: 'USD',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
      },
    });
    testLicenseId = testLicense.id;
  });

  afterAll(async () => {
    // Clean up dedicated test license and its allocations/audits
    if (testLicenseId) {
      await systemPrisma.licenseAllocation.deleteMany({ where: { licenseId: testLicenseId } });
      await systemPrisma.licenseRenewal.deleteMany({ where: { licenseId: testLicenseId } });
      await systemPrisma.license.delete({ where: { id: testLicenseId } }).catch(() => {});
    }
  });

  // ----------------------------------------------------------------------------
  // 1. Audit Log Uniqueness & Stored Procedure Integrity
  // ----------------------------------------------------------------------------
  describe('1. Audit Log Singularity & Stored Procedures (sp_allocate/release)', () => {
    let createdAllocationId: string;

    it('sp_allocate_license_seat creates an active seat and exactly ONE audit log entry', async () => {
      // 1. Call stored procedure sp_allocate_license_seat
      const result: any = await prisma.$queryRaw(
        Prisma.sql`CALL sp_allocate_license_seat(
          ${testLicenseId}::UUID,
          ${userAMemberId}::UUID,
          ${userAAdminId}::UUID,
          NULL
        );`
      );

      createdAllocationId = result?.[0]?.p_allocation_id;
      expect(createdAllocationId).toBeDefined();

      // 2. Verify allocation in license_allocations table
      const allocation = await systemPrisma.licenseAllocation.findUnique({
        where: { id: createdAllocationId },
      });
      expect(allocation).not.toBeNull();
      expect(allocation!.status).toBe('ACTIVE');
      expect(allocation!.licenseId).toBe(testLicenseId);
      expect(allocation!.userId).toBe(userAMemberId);

      // 3. Verify exactly ONE audit log row was generated (NOT duplicate)
      const auditLogs = await systemPrisma.auditLog.findMany({
        where: {
          tableName: 'license_allocations',
          recordId: createdAllocationId,
        },
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0]!.action).toBe('INSERT');
      expect(auditLogs[0]!.tenantId).toBe(tenantAId);
      expect(auditLogs[0]!.userId).toBe(userAAdminId);
    });

    it('sp_release_license_seat revokes seat, appends reason to notes, and emits exactly ONE audit log row', async () => {
      const revocationReason = 'Employee department transfer to Infrastructure Unit';

      // 1. Call stored procedure sp_release_license_seat with custom reason
      await prisma.$executeRaw(
        Prisma.sql`CALL sp_release_license_seat(
          ${createdAllocationId}::UUID,
          ${userAAdminId}::UUID,
          ${revocationReason}
        );`
      );

      // 2. Verify allocation updated in database
      const allocation = await systemPrisma.licenseAllocation.findUnique({
        where: { id: createdAllocationId },
      });
      expect(allocation).not.toBeNull();
      expect(allocation!.status).toBe('REVOKED');
      expect(allocation!.releasedAt).not.toBeNull();

      // Verify reason appended to notes
      const notesRaw: any = await prisma.$queryRaw(
        Prisma.sql`SELECT notes FROM license_allocations WHERE id = ${createdAllocationId}::UUID;`
      );
      expect(notesRaw[0]?.notes).toContain(`Revoked: ${revocationReason}`);

      // 3. Verify exactly TWO audit log rows total for this allocation (1 INSERT + 1 UPDATE)
      const auditLogs = await systemPrisma.auditLog.findMany({
        where: {
          tableName: 'license_allocations',
          recordId: createdAllocationId,
        },
        orderBy: { performedAt: 'asc' },
      });

      expect(auditLogs.length).toBe(2);
      expect(auditLogs[0]!.action).toBe('INSERT');
      expect(auditLogs[1]!.action).toBe('UPDATE');
      expect(auditLogs[1]!.userId).toBe(userAAdminId);
      expect(auditLogs[1]!.tenantId).toBe(tenantAId);
    });

    it('sp_allocate_license_seat rejects allocation when seats are exhausted', async () => {
      // License has 2 seats total.
      // Allocate seat 1 to userAAdminId
      await prisma.$executeRaw(
        Prisma.sql`CALL sp_allocate_license_seat(
          ${testLicenseId}::UUID,
          ${userAAdminId}::UUID,
          ${userAAdminId}::UUID,
          NULL
        );`
      );

      // Allocate seat 2 to userAMemberId
      await prisma.$executeRaw(
        Prisma.sql`CALL sp_allocate_license_seat(
          ${testLicenseId}::UUID,
          ${userAMemberId}::UUID,
          ${userAAdminId}::UUID,
          NULL
        );`
      );

      // Attempt 3rd seat allocation should fail with check_violation
      await expect(
        prisma.$executeRaw(
          Prisma.sql`CALL sp_allocate_license_seat(
            ${testLicenseId}::UUID,
            ${userAAdminId}::UUID,
            ${userAAdminId}::UUID,
            NULL
          );`
        )
      ).rejects.toThrow();
    });

    it('sp_renew_license extends end date, logs renewal, and generates triggers audit logs', async () => {
      const newEndDate = '2028-06-30';
      const renewalCost = 300.0;

      const result: any = await prisma.$queryRaw(
        Prisma.sql`CALL sp_renew_license(
          ${testLicenseId}::UUID,
          ${newEndDate}::DATE,
          ${renewalCost}::NUMERIC,
          ${userAAdminId}::UUID,
          'Contract extension for FY28',
          NULL
        );`
      );

      const renewalId = result?.[0]?.p_renewal_id;
      expect(renewalId).toBeDefined();

      // Verify license end_date updated
      const updatedLicense = await systemPrisma.license.findUnique({
        where: { id: testLicenseId },
      });
      expect(updatedLicense!.endDate?.toISOString().slice(0, 10)).toBe(newEndDate);

      // Verify renewal record created
      const renewal = await systemPrisma.licenseRenewal.findUnique({
        where: { id: renewalId },
      });
      expect(renewal).not.toBeNull();
      expect(Number(renewal!.cost)).toBe(renewalCost);

      // Verify audit trail captured renewal
      const renewalAudit = await systemPrisma.auditLog.findFirst({
        where: {
          tableName: 'license_renewals',
          recordId: renewalId,
        },
      });
      expect(renewalAudit).not.toBeNull();
      expect(renewalAudit!.action).toBe('INSERT');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Database Triggers Enforcement
  // ----------------------------------------------------------------------------
  describe('2. Integrity & Security Triggers', () => {
    it('trg_audit_immutable blocks UPDATE and DELETE on audit_logs with error 28000', async () => {
      // Find an existing audit log
      const log = await systemPrisma.auditLog.findFirst();
      expect(log).not.toBeNull();

      // Attempting to UPDATE an audit log row must fail
      await expect(
        prisma.$executeRaw`UPDATE audit_logs SET action = 'DELETE' WHERE id = ${log!.id}::BIGINT;`
      ).rejects.toThrow();

      // Attempting to DELETE an audit log row must fail
      await expect(
        prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${log!.id}::BIGINT;`
      ).rejects.toThrow();
    });

    it('trg_enforce_asset_tenant rejects creating asset whose owner belongs to another tenant', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO assets (
            id, tenant_id, owner_id, asset_code, name, asset_type, status
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${userBMemberId}::UUID, -- Tenant B user!
            'ILLEGAL-CROSS-TENANT',
            'Cross Tenant Exploit Asset',
            'SOFTWARE'::asset_type,
            'ACTIVE'::asset_status
          );`
        )
      ).rejects.toThrow(/Cross-tenant violation/i);
    });

    it('trg_enforce_license_tenant rejects creating license with vendor of another tenant', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO licenses (
            id, tenant_id, vendor_id, license_type_id, name, license_key, total_seats, cost, status
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${vendorBId}::UUID, -- Tenant B vendor!
            1,
            'Illegal Cross Tenant License',
            'KEY-X-TENANT',
            5,
            100.0,
            'ACTIVE'::license_status
          );`
        )
      ).rejects.toThrow(/Cross-tenant violation/i);
    });

    it('redacts license keys from INSERT and UPDATE audit snapshots', async () => {
      const rotatedKey = `TEST-SP-ROTATED-${Date.now()}`;

      // Update the fixture license so the audit row contains both old and new snapshots.
      await systemPrisma.license.update({
        where: { id: testLicenseId },
        data: { licenseKey: rotatedKey },
      });

      const audit = await systemPrisma.auditLog.findFirst({
        where: {
          tableName: 'licenses',
          recordId: testLicenseId,
          action: 'UPDATE',
        },
        orderBy: { performedAt: 'desc' },
      });

      expect(audit).not.toBeNull();
      const oldSnapshot = JSON.stringify(audit!.oldData ?? {});
      const newSnapshot = JSON.stringify(audit!.newData ?? {});
      for (const snapshot of [oldSnapshot, newSnapshot]) {
        expect(snapshot).not.toContain('license_key');
        expect(snapshot).not.toContain(testLicenseKey);
        expect(snapshot).not.toContain(rotatedKey);
      }
    });

    it('trg_audit_vendors automatically captures vendor mutations', async () => {
      const vendorName = `Audit Test Vendor ${Date.now()}`;
      const newVendor = await systemPrisma.vendor.create({
        data: {
          tenantId: tenantAId,
          name: vendorName,
        },
      });

      const audit = await systemPrisma.auditLog.findFirst({
        where: {
          tableName: 'vendors',
          recordId: newVendor.id,
        },
      });

      expect(audit).not.toBeNull();
      expect(audit!.action).toBe('INSERT');

      // Cleanup
      await systemPrisma.vendor.delete({ where: { id: newVendor.id } });
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Declarative CHECK Constraints & Trigram Indexes
  // ----------------------------------------------------------------------------
  describe('3. Domain CHECK Constraints & Specialized Indexes', () => {
    it('enforces chk_licenses_dates (end_date > start_date)', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO licenses (
            id, tenant_id, vendor_id, license_type_id, name, license_key, total_seats, cost, status, start_date, end_date
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${vendorAId}::UUID,
            2,
            'Invalid Date License',
            ${'BAD-DATE-' + Date.now()},
            5,
            50.0,
            'ACTIVE'::license_status,
            '2026-12-31'::DATE,
            '2026-01-01'::DATE -- End date before start date!
          );`
        )
      ).rejects.toThrow();
    });

    it('enforces chk_licenses_total_seats (total_seats >= 1)', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO licenses (
            id, tenant_id, vendor_id, license_type_id, name, license_key, total_seats, cost, status
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${vendorAId}::UUID,
            2,
            'Zero Seat License',
            ${'ZERO-SEAT-' + Date.now()},
            0, -- Invalid seats!
            50.0,
            'ACTIVE'::license_status
          );`
        )
      ).rejects.toThrow();
    });

    it('verifies GIN trigram indexes and partial index catalog', async () => {
      const indexes: any = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND indexname IN (
            'idx_assets_name_trgm', 
            'idx_licenses_name_trgm', 
            'idx_license_alloc_active',
            'idx_assets_deleted_at',
            'idx_licenses_deleted_at',
            'idx_notifications_user_unread'
          );
      `;
      const indexNames = indexes.map((i: any) => i.indexname);
      expect(indexNames).toContain('idx_assets_name_trgm');
      expect(indexNames).toContain('idx_licenses_name_trgm');
      expect(indexNames).toContain('idx_license_alloc_active');
      expect(indexNames).toContain('idx_assets_deleted_at');
      expect(indexNames).toContain('idx_licenses_deleted_at');
      expect(indexNames).toContain('idx_notifications_user_unread');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. PostgreSQL Views & Materialized Views
  // ----------------------------------------------------------------------------
  describe('4. Real-time Analytical & Materialized Views', () => {
    it('queries v_license_utilization successfully with calculated columns and filter columns', async () => {
      const views: any = await prisma.$queryRaw`
        SELECT * FROM v_license_utilization WHERE tenant_id = ${tenantAId}::UUID LIMIT 5;
      `;
      expect(Array.isArray(views)).toBe(true);
      if (views.length > 0) {
        expect(views[0]).toHaveProperty('license_id');
        expect(views[0]).toHaveProperty('used_seats');
        expect(views[0]).toHaveProperty('available_seats');
        expect(views[0]).toHaveProperty('utilization_pct');
        // Filter columns exposed for backend queries
        expect(views[0]).toHaveProperty('vendor_id');
        expect(views[0]).toHaveProperty('license_type_id');
      }
    });

    it('queries v_asset_catalog with taxonomic category, tags array, and filter columns', async () => {
      const catalog: any = await prisma.$queryRaw`
        SELECT * FROM v_asset_catalog WHERE tenant_id = ${tenantAId}::UUID LIMIT 5;
      `;
      expect(Array.isArray(catalog)).toBe(true);
      if (catalog.length > 0) {
        expect(catalog[0]).toHaveProperty('asset_id');
        expect(catalog[0]).toHaveProperty('asset_code');
        expect(catalog[0]).toHaveProperty('tags');
        // Filter columns exposed for backend queries
        expect(catalog[0]).toHaveProperty('category_id');
        expect(catalog[0]).toHaveProperty('owner_id');
        // Compliance status derived correctly
        expect(['COMPLIANT', 'UNLICENSED', 'EXPIRED_LICENSE']).toContain(catalog[0].compliance_status);
      }
    });

    it('queries monthly spend and top-download analytics views', async () => {
      const spendRows: any[] = await prisma.$queryRaw`
        SELECT tenant_id, month_year, monthly_spend, running_total_spend
        FROM v_monthly_spend
        WHERE tenant_id = ${tenantAId}::UUID
        ORDER BY month_year
        LIMIT 5;
      `;
      expect(Array.isArray(spendRows)).toBe(true);
      if (spendRows.length > 0) {
        expect(spendRows[0]).toHaveProperty('monthly_spend');
        expect(spendRows[0]).toHaveProperty('running_total_spend');
      }

      const topRows: any[] = await prisma.$queryRaw`
        SELECT tenant_id, asset_id, asset_name, download_count, rank
        FROM v_top_downloaded_assets
        WHERE tenant_id = ${tenantAId}::UUID
        ORDER BY rank, asset_name
        LIMIT 10;
      `;
      expect(Array.isArray(topRows)).toBe(true);
      expect(topRows.length).toBeLessThanOrEqual(10);
      if (topRows.length > 0) {
        expect(topRows[0]).toHaveProperty('download_count');
        expect(topRows[0]).toHaveProperty('rank');
      }
    });

    it('fn_tenant_dashboard_stats returns all KPIs including new user_count, unlicensed_assets_count, and asset_type_breakdown', async () => {
      const result: any = await prisma.$queryRaw`
        SELECT fn_tenant_dashboard_stats(${tenantAId}::UUID) AS stats;
      `;
      const stats = result[0]?.stats;
      expect(stats).toBeDefined();
      // Existing KPIs
      expect(stats).toHaveProperty('total_assets');
      expect(stats).toHaveProperty('total_licenses');
      expect(stats).toHaveProperty('total_seats');
      expect(stats).toHaveProperty('allocated_seats');
      expect(stats).toHaveProperty('expiring_in_30_days');
      expect(stats).toHaveProperty('monthly_plan_price');
      expect(stats).toHaveProperty('total_license_cost');
      expect(stats).toHaveProperty('storage_used_bytes');
      // New KPIs
      expect(stats).toHaveProperty('user_count');
      expect(typeof stats.user_count).toBe('number');
      expect(stats.user_count).toBeGreaterThan(0);
      expect(stats).toHaveProperty('unlicensed_assets_count');
      expect(typeof stats.unlicensed_assets_count).toBe('number');
      expect(stats).toHaveProperty('asset_type_breakdown');
      expect(typeof stats.asset_type_breakdown).toBe('object');
    });

    it('does not multiply initial vendor spend when one license has multiple renewals', async () => {
      // Ensure a single license has at least two renewal rows to catch fan-out bugs.
      await systemPrisma.licenseRenewal.createMany({
        data: [
          {
            licenseId: testLicenseId,
            renewedBy: userAAdminId,
            oldEndDate: new Date('2027-01-01'),
            newEndDate: new Date('2028-01-01'),
            cost: new Prisma.Decimal(25),
            notes: 'vendor-spend aggregation regression fixture A',
          },
          {
            licenseId: testLicenseId,
            renewedBy: userAAdminId,
            oldEndDate: new Date('2028-01-01'),
            newEndDate: new Date('2029-01-01'),
            cost: new Prisma.Decimal(40),
            notes: 'vendor-spend aggregation regression fixture B',
          },
        ],
      });

      const [viewRows, expectedRows] = await Promise.all([
        prisma.$queryRaw<Array<{ total_initial_cost: Prisma.Decimal; total_renewal_cost: Prisma.Decimal; total_seats_contracted: bigint }>>(
          Prisma.sql`SELECT total_initial_cost, total_renewal_cost, total_seats_contracted
                      FROM v_vendor_spend
                      WHERE tenant_id = ${tenantAId}::uuid AND vendor_id = ${vendorAId}::uuid;`
        ),
        prisma.$queryRaw<Array<{ total_initial_cost: Prisma.Decimal; total_renewal_cost: Prisma.Decimal; total_seats_contracted: bigint }>>(
          Prisma.sql`SELECT
            COALESCE((
              SELECT SUM(l.cost) FROM licenses l
              WHERE l.tenant_id = ${tenantAId}::uuid
                AND l.vendor_id = ${vendorAId}::uuid
                AND l.deleted_at IS NULL
            ), 0)::NUMERIC(12,2) AS total_initial_cost,
            COALESCE((
              SELECT SUM(lr.cost)
              FROM license_renewals lr
              JOIN licenses l ON l.id = lr.license_id
              WHERE l.tenant_id = ${tenantAId}::uuid
                AND l.vendor_id = ${vendorAId}::uuid
                AND l.deleted_at IS NULL
            ), 0)::NUMERIC(12,2) AS total_renewal_cost,
            COALESCE((
              SELECT SUM(l.total_seats) FROM licenses l
              WHERE l.tenant_id = ${tenantAId}::uuid
                AND l.vendor_id = ${vendorAId}::uuid
                AND l.deleted_at IS NULL
            ), 0)::BIGINT AS total_seats_contracted;`
        ),
      ]);

      expect(viewRows).toHaveLength(1);
      expect(expectedRows).toHaveLength(1);
      const viewRow = viewRows[0]!;
      const expectedRow = expectedRows[0]!;
      expect(Number(viewRow.total_initial_cost)).toBe(Number(expectedRow.total_initial_cost));
      expect(Number(viewRow.total_renewal_cost)).toBe(Number(expectedRow.total_renewal_cost));
      expect(Number(viewRow.total_seats_contracted)).toBe(Number(expectedRow.total_seats_contracted));
    });

    it('marks tenant reporting views as security-invoker views', async () => {
      const viewOptions: any[] = await prisma.$queryRaw`
        SELECT relname, reloptions
        FROM pg_class
        WHERE relkind = 'v'
          AND relname IN (
            'v_license_utilization',
            'v_expiring_licenses',
            'v_asset_catalog',
            'v_vendor_spend',
            'v_tenant_summary',
            'v_monthly_spend',
            'v_top_downloaded_assets'
          );
      `;

      expect(viewOptions).toHaveLength(7);
      for (const view of viewOptions) {
        expect(view.reloptions || []).toContain('security_invoker=true');
      }
    });

    it('does not grant tenant runtime direct SELECT on the all-tenant materialized view', async () => {
      const privileges: any[] = await prisma.$queryRaw`
        SELECT
          has_table_privilege('assetvault_app', 'mv_monthly_access_stats', 'SELECT') AS can_read_raw,
          has_table_privilege('assetvault_app', 'v_monthly_access_stats_tenant', 'SELECT') AS can_read_filtered;
      `;

      expect(privileges[0].can_read_raw).toBe(false);
      expect(privileges[0].can_read_filtered).toBe(true);
    });

    it('refreshes materialized view mv_monthly_access_stats concurrently', async () => {
      await expect(
        prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats;`
      ).resolves.not.toThrow();
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Row-Level Security (RLS) Isolation
  // ----------------------------------------------------------------------------
  describe('5. Row-Level Security (RLS) Multi-Tenant Isolation', () => {
    it('enforces isolation: tenant A session cannot read tenant B records under RLS', async () => {
      const tenantAAssets = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL ROLE assetvault_app;`);
        await tx.$executeRaw(
          Prisma.sql`SELECT 
            set_config('app.current_tenant_id', ${tenantAId}, true),
            set_config('app.is_super_admin', 'false', true);`
        );
        return await tx.$queryRaw(
          Prisma.sql`SELECT id, tenant_id FROM assets WHERE tenant_id = ${tenantBId}::UUID;`
        );
      });

      expect((tenantAAssets as any[]).length).toBe(0);
    });

    it('enforces tenant RLS through security-invoker reporting views', async () => {
      const foreignTenantRows = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL ROLE assetvault_app;`);
        await tx.$executeRaw(
          Prisma.sql`SELECT
            set_config('app.current_tenant_id', ${tenantAId}, true),
            set_config('app.is_super_admin', 'false', true);`
        );
        return tx.$queryRaw(
          Prisma.sql`SELECT asset_id, tenant_id FROM v_asset_catalog WHERE tenant_id = ${tenantBId}::uuid;`
        );
      });

      expect(foreignTenantRows).toHaveLength(0);
    });

    it('filters the all-tenant monthly stats wrapper to the current tenant', async () => {
      const rows = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL ROLE assetvault_app;`);
        await tx.$executeRaw(
          Prisma.sql`SELECT
            set_config('app.current_tenant_id', ${tenantAId}, true),
            set_config('app.is_super_admin', 'false', true);`
        );
        return tx.$queryRaw(Prisma.sql`SELECT tenant_id FROM v_monthly_access_stats_tenant;`);
      });

      expect((rows as any[]).every((row) => row.tenant_id === tenantAId)).toBe(true);
    });

    it('allows super admin session to query across all tenants', async () => {
      const allTenantsAssets = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL ROLE assetvault_app;`);
        await tx.$executeRaw(
          Prisma.sql`SELECT 
            set_config('app.current_tenant_id', '', true),
            set_config('app.is_super_admin', 'true', true);`
        );
        return await tx.$queryRaw`SELECT COUNT(*)::INT as total FROM assets;`;
      });

      expect((allTenantsAssets as any[])[0].total).toBeGreaterThan(0);
    });
    it('does not classify a ten-day-old allocation with no access logs as dormant', async () => {
      const recentAllocationAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const allocation = await systemPrisma.licenseAllocation.create({
        data: {
          licenseId: testLicenseId,
          userId: userAAdminId,
          allocatedBy: userAAdminId,
          allocatedAt: recentAllocationAt,
          status: 'ACTIVE',
          notes: 'recent allocation inactivity regression test',
        },
      });

      try {
        const report = await costOptimizationService.getUnusedSeatsReport(tenantAId);
        expect(report.reclaimCandidates.some((candidate) => candidate.allocationId === allocation.id)).toBe(false);
      } finally {
        await systemPrisma.licenseAllocation.delete({ where: { id: allocation.id } });
      }
    });
  });
});
