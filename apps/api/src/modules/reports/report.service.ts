import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class ReportService {
  /**
   * Queries SQL view v_license_utilization_summary for the tenant
   */
  async getLicenseUtilization(tenantId: string) {
    const records = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT 
        license_id,
        license_name,
        vendor_name,
        license_type,
        total_seats,
        allocated_seats,
        available_seats,
        utilization_pct,
        cost,
        currency,
        cost_per_seat,
        status,
        expires_at
      FROM v_license_utilization_summary
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY utilization_pct DESC;
    `);

    return records;
  }

  /**
   * Queries SQL view v_expiring_licenses_30d for the tenant
   */
  async getExpiringLicenses(tenantId: string) {
    const records = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT 
        license_id,
        license_name,
        vendor_name,
        vendor_email,
        expires_at,
        days_remaining,
        cost,
        currency,
        is_auto_renew
      FROM v_expiring_licenses_30d
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY days_remaining ASC;
    `);

    return records;
  }

  /**
   * Queries SQL view v_tenant_storage_stats for resource consumption
   */
  async getStorageStats(tenantId: string) {
    const records = await prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT 
        tenant_id,
        tenant_name,
        subscription_tier,
        total_assets,
        total_storage_bytes,
        total_storage_gb,
        software_count,
        dataset_count,
        font_count,
        image_count,
        video_count
      FROM v_tenant_storage_stats
      WHERE tenant_id = ${tenantId}::uuid;
    `);

    return records[0] || null;
  }

  /**
   * Aggregated dashboard overview metrics
   */
  async getDashboardOverview(tenantId: string) {
    const [
      assetCount,
      licenseCount,
      activeUserCount,
      recentAuditLogs,
      recentExpiring,
      monthlySpendRaw,
    ] = await Promise.all([
      prisma.asset.count({ where: { tenantId, deletedAt: null } }),
      prisma.license.count({ where: { tenantId, deletedAt: null } }),
      prisma.user.count({ where: { tenantId, isActive: true } }),
      prisma.auditLog.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
      this.getExpiringLicenses(tenantId),
      prisma.$queryRaw<{ total_spend: string | null }[]>(Prisma.sql`
        SELECT COALESCE(SUM(cost), 0)::text AS total_spend
        FROM licenses
        WHERE tenant_id = ${tenantId}::uuid
          AND deleted_at IS NULL
          AND status = 'active';
      `),
    ]);

    const totalSpend = monthlySpendRaw[0]?.total_spend || '0.00';

    return {
      metrics: {
        totalAssets: assetCount,
        totalLicenses: licenseCount,
        activeUsers: activeUserCount,
        totalLicenseSpend: parseFloat(totalSpend),
      },
      recentExpiringLicenses: recentExpiring.slice(0, 5),
      recentActivity: recentAuditLogs,
    };
  }
}

export const reportService = new ReportService();
