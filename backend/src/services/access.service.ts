// ==============================================================================
// AssetVault: Asset Access Service (Checkout, Checkin, Download, Access Logs)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces atomic license seat validation before checkout and download
// ==============================================================================

import { accessRepository, AccessLogFilterOptions } from '../repositories/access.repository';
import { NotFoundError, ForbiddenError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export class AccessService {
  /**
   * Atomic Asset Checkout
   * Transaction 3: Verifies active seat allocation, logs access, and updates asset status
   */
  public async checkoutAsset(
    tenantId: string,
    assetId: string,
    userId: string,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const asset = await tx.asset.findFirst({
        where: { id: assetId, deletedAt: null },
      });
      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      // Check seat coverage
      const hasSeat = await accessRepository.verifyUserSeatCoverage(tx, assetId, userId);
      if (!hasSeat) {
        throw new ForbiddenError(
          'Checkout rejected: User does not hold an active seat allocation on a covering license for this asset.'
        );
      }

      // Create access log
      await tx.assetAccessLog.create({
        data: {
          assetId,
          userId,
          action: 'CHECKOUT',
          ipAddress: metadata.ipAddress || null,
        },
      });

      // Checkout is an access event, not an asset lifecycle transition.
      return {
        success: true,
        message: 'Asset successfully checked out',
        asset,
      };
    });
  }

  /**
   * Atomic Asset Checkin
   */
  public async checkinAsset(
    tenantId: string,
    assetId: string,
    userId: string,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const asset = await tx.asset.findFirst({
        where: { id: assetId, deletedAt: null },
      });
      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      await tx.assetAccessLog.create({
        data: {
          assetId,
          userId,
          action: 'CHECKIN',
          ipAddress: metadata.ipAddress || null,
        },
      });

      // Check-in is an access event, not an asset lifecycle transition.
      return {
        success: true,
        message: 'Asset successfully checked in',
        asset,
      };
    });
  }

  /**
   * Seat-Gated Asset Download
   */
  public async downloadAsset(
    tenantId: string,
    assetId: string,
    userId: string,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const asset = await tx.asset.findFirst({
        where: { id: assetId, deletedAt: null },
        include: {
          versions: { orderBy: { versionNo: 'desc' }, take: 1 },
        },
      });

      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      const latestVersion = asset.versions[0];
      if (!latestVersion) {
        throw new BadRequestError('Asset has no uploaded file versions.');
      }

      // Verify seat coverage
      const hasSeat = await accessRepository.verifyUserSeatCoverage(tx, assetId, userId);
      if (!hasSeat) {
        throw new ForbiddenError(
          'Download forbidden: You must hold an active allocated seat on a covering license to download this asset.'
        );
      }

      // Log the download event
      await accessRepository.logAction(tx, assetId, userId, 'DOWNLOAD', metadata);

      return {
        assetId,
        assetName: asset.name,
        versionNo: latestVersion.versionNo,
        fileUrl: latestVersion.fileUrl,
        fileSizeBytes: Number(latestVersion.fileSizeBytes),
        checksumSha256: latestVersion.checksumSha256,
      };
    });
  }

  public async listAccessLogs(prismaClient: any, params: PaginationParams, filter: AccessLogFilterOptions) {
    const { data, total } = await accessRepository.findAccessLogs(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async listAccessLogsCursor(
    prismaClient: any,
    cursor?: string,
    limit: number = 20,
    filter: AccessLogFilterOptions = {}
  ) {
    const take = Math.min(100, Math.max(1, limit));
    const where: any = {};
    if (filter.assetId) where.assetId = filter.assetId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.action) where.action = filter.action;
    if (filter.dateFrom || filter.dateTo) {
      where.accessedAt = {};
      if (filter.dateFrom) where.accessedAt.gte = filter.dateFrom;
      if (filter.dateTo) where.accessedAt.lte = filter.dateTo;
    }

    const queryOptions: any = {
      where,
      take: take + 1,
      orderBy: { id: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        asset: { select: { id: true, name: true, assetCode: true } },
      },
    };

    if (cursor) {
      queryOptions.cursor = { id: BigInt(cursor) };
      queryOptions.skip = 1;
    }

    const items = await prismaClient.assetAccessLog.findMany(queryOptions);
    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id.toString() : null;

    return {
      data,
      meta: {
        limit: take,
        hasMore,
        nextCursor,
      },
    };
  }
}

export const accessService = new AccessService();
