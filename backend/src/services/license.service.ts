// ==============================================================================
// AssetVault: License Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces key masking on list/MEMBER views and audit logging on key reveal
// ==============================================================================

import { licenseRepository, LicenseFilterOptions } from '../repositories/license.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { toCsv } from '../utils/csv.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export class LicenseService {
  private maskKey(key: string | null | undefined): string | null {
    if (!key) return null;
    return `••••••••-${key.slice(-4)}`;
  }

  public async listLicenses(
    prismaClient: any,
    tenantId: string,
    params: PaginationParams,
    filter: LicenseFilterOptions
  ) {
    const { data, total } = await licenseRepository.findUtilization(prismaClient, tenantId, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getLicenseById(
    prismaClient: any,
    id: string,
    callerRole: string,
    callerUserId: string,
    tenantId: string
  ) {
    const license = await licenseRepository.findById(prismaClient, id);
    if (!license) {
      throw new NotFoundError('License not found');
    }

    const canViewRawKey = callerRole === 'TENANT_ADMIN' || callerRole === 'ASSET_MANAGER' || callerRole === 'SUPER_ADMIN';

    if (canViewRawKey) {
      // Record key reveal in audit trail
      await prismaClient.auditLog.create({
        data: {
          tenant: tenantId ? { connect: { id: tenantId } } : undefined,
          tableName: 'licenses',
          recordId: id,
          action: 'UPDATE',
          user: callerUserId ? { connect: { id: callerUserId } } : undefined,
          newData: {
            event: 'LICENSE_KEY_REVEALED',
            accessedBy: callerUserId,
            revealedAt: new Date().toISOString(),
          },
        },
      });

      return license;
    } else {
      // Mask key for standard members
      return {
        ...license,
        licenseKey: this.maskKey(license.licenseKey),
      };
    }
  }

  public async createLicense(prismaClient: any, tenantId: string, data: any) {
    const vendor = await prismaClient.vendor.findFirst({ where: { id: data.vendorId } });
    if (!vendor) throw new BadRequestError('Referenced vendor does not exist');

    const licenseType = await prismaClient.licenseType.findUnique({ where: { id: data.licenseTypeId } });
    if (!licenseType) throw new BadRequestError('Referenced licenseType does not exist');

    return licenseRepository.create(prismaClient, {
      name: data.name,
      licenseKey: data.licenseKey,
      totalSeats: data.totalSeats,
      cost: data.cost,
      currency: data.currency,
      startDate: data.startDate,
      endDate: data.endDate,
      autoRenew: data.autoRenew,
      status: 'ACTIVE',
      vendor: { connect: { id: data.vendorId } },
      licenseType: { connect: { id: data.licenseTypeId } },
      tenant: { connect: { id: tenantId } },
    });
  }

  public async updateLicense(
    prismaClient: any,
    id: string,
    data: any,
    actor: { tenantId?: string; userId?: string } = {}
  ) {
    const existing = await licenseRepository.findById(prismaClient, id);
    if (!existing) throw new NotFoundError('License not found');

    const tenantId = actor.tenantId || existing.tenantId;
    return prismaClient.$transaction(async (tx: any) => {
      // Serialize capacity changes with seat allocations, which lock this same
      // license row before counting active allocations.
      await tx.$executeRaw(
        Prisma.sql`SELECT
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${actor.userId || ''}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const lockedRows = await tx.$queryRaw(
        Prisma.sql`SELECT start_date, end_date
                    FROM licenses
                    WHERE id = ${id}::UUID AND deleted_at IS NULL
                    FOR UPDATE;`
      );
      const lockedLicense = (lockedRows as any[])[0];
      if (!lockedLicense) throw new NotFoundError('License not found');

      const nextStartDate = data.startDate ?? lockedLicense.start_date;
      const nextEndDate = data.endDate === undefined ? lockedLicense.end_date : data.endDate;
      if (nextEndDate && nextEndDate <= nextStartDate) {
        throw new BadRequestError('End date must be after start date');
      }

      if (data.totalSeats !== undefined) {
        const allocationRows = await tx.$queryRaw(
          Prisma.sql`SELECT COUNT(*)::int AS active_count
                      FROM license_allocations
                      WHERE license_id = ${id}::UUID AND status = 'ACTIVE';`
        );
        const activeCount = Number((allocationRows as any[])[0]?.active_count || 0);
        if (data.totalSeats < activeCount) {
          throw new ConflictError(
            `Cannot reduce total seats below the ${activeCount} active allocation(s).`
          );
        }
      }

      return licenseRepository.update(tx, id, {
        name: data.name,
        licenseKey: data.licenseKey,
        totalSeats: data.totalSeats,
        cost: data.cost,
        currency: data.currency,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        autoRenew: data.autoRenew,
        vendor: data.vendorId ? { connect: { id: data.vendorId } } : undefined,
        licenseType: data.licenseTypeId ? { connect: { id: data.licenseTypeId } } : undefined,
      });
    });
  }

  public async softDeleteLicense(prismaClient: any, id: string) {
    const existing = await licenseRepository.findById(prismaClient, id);
    if (!existing) throw new NotFoundError('License not found');
    return licenseRepository.softDelete(prismaClient, id);
  }

  public async restoreLicense(prismaClient: any, id: string) {
    const existing = await licenseRepository.findById(prismaClient, id, true);
    if (!existing) throw new NotFoundError('License not found');
    return licenseRepository.restore(prismaClient, id);
  }

  /**
   * Invokes stored procedure sp_renew_license
   */
  public async renewLicense(
    tenantId: string,
    licenseId: string,
    newEndDate: Date,
    cost: number,
    performedBy: string,
    notes?: string
  ) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${performedBy}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      await licenseRepository.renew(tx, licenseId, newEndDate, cost, performedBy, notes);

      return {
        success: true,
        message: 'License renewed successfully via sp_renew_license',
        licenseId,
        newEndDate,
      };
    });
  }

  public async findRenewals(prismaClient: any, licenseId: string) {
    const existing = await licenseRepository.findById(prismaClient, licenseId);
    if (!existing) throw new NotFoundError('License not found');
    return licenseRepository.findRenewals(prismaClient, licenseId);
  }

  public async linkAsset(prismaClient: any, assetId: string, licenseId: string) {
    const [asset, license] = await Promise.all([
      prismaClient.asset.findFirst({ where: { id: assetId, deletedAt: null } }),
      prismaClient.license.findFirst({ where: { id: licenseId, deletedAt: null } }),
    ]);

    if (!asset) throw new NotFoundError('Asset not found');
    if (!license) throw new NotFoundError('License not found');

    const existing = await prismaClient.assetLicense.findUnique({
      where: { assetId_licenseId: { assetId, licenseId } },
    });
    if (existing) {
      throw new ConflictError('Asset is already covered by this license.');
    }

    return licenseRepository.linkAsset(prismaClient, assetId, licenseId);
  }

  public async unlinkAsset(prismaClient: any, assetId: string, licenseId: string) {
    return licenseRepository.unlinkAsset(prismaClient, assetId, licenseId);
  }

  public async findLicensesByAsset(prismaClient: any, assetId: string) {
    return licenseRepository.findLicensesByAsset(prismaClient, assetId);
  }

  public async findAssetsByLicense(prismaClient: any, licenseId: string) {
    return licenseRepository.findAssetsByLicense(prismaClient, licenseId);
  }

  public async exportCsv(prismaClient: any, tenantId: string): Promise<string> {
    const { data } = await licenseRepository.findUtilization(
      prismaClient,
      tenantId,
      { page: 1, limit: 10000, skip: 0, sort: 'license_name', order: 'asc' },
      {}
    );

    return toCsv(data, [
      'license_id',
      'license_name',
      'vendor_name',
      'license_type',
      'total_seats',
      'used_seats',
      'available_seats',
      'utilization_pct',
      'days_to_expiry',
      'status',
      'start_date',
      'end_date',
      'cost',
      'currency',
    ]);
  }
}

export const licenseService = new LicenseService();
