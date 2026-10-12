import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { PaginationParams } from '../../utils/pagination.util';

export class AssetRepository {
  async findMany(tenantId: string, params: PaginationParams, filters?: {
    categoryId?: string;
    assetType?: string;
    tagId?: string;
  }) {
    const where: Prisma.AssetWhereInput = {
      tenantId,
      deletedAt: null, // Soft delete filter
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.assetType ? { assetType: filters.assetType } : {}),
      ...(filters?.tagId ? { assetTags: { some: { tagId: filters.tagId } } } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { description: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: {
          category: { select: { id: true, name: true } },
          createdByUser: { select: { id: true, fullName: true, email: true } },
          assetTags: {
            include: { tag: { select: { id: true, name: true, colorHex: true } } },
          },
          assetLicenses: {
            include: {
              license: {
                select: {
                  id: true,
                  name: true,
                  licenseType: true,
                  expiresAt: true,
                  status: true,
                  vendor: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return { total, assets };
  }

  async findById(tenantId: string, id: string) {
    return prisma.asset.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: true,
        createdByUser: { select: { id: true, fullName: true, email: true } },
        assetTags: {
          include: { tag: true },
        },
        assetLicenses: {
          include: {
            license: {
              include: {
                vendor: true,
                _count: { select: { allocations: { where: { revokedAt: null } } } },
              },
            },
          },
        },
        accessLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { fullName: true, email: true } } },
        },
      },
    });
  }

  async create(data: Prisma.AssetCreateInput) {
    return prisma.asset.create({ data });
  }

  async update(id: string, data: Prisma.AssetUpdateInput) {
    return prisma.asset.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async logAccess(assetId: string, userId: string | null, action: string, ipAddress?: string, userAgent?: string) {
    return prisma.assetAccessLog.create({
      data: {
        assetId,
        userId,
        action,
        ipAddress,
        userAgent,
      },
    });
  }
}

export const assetRepository = new AssetRepository();
