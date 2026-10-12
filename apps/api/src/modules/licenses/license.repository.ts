import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { PaginationParams } from '../../utils/pagination.util';

export class LicenseRepository {
  async findMany(tenantId: string, params: PaginationParams, filters?: {
    vendorId?: string;
    licenseType?: string;
    status?: string;
  }) {
    const where: Prisma.LicenseWhereInput = {
      tenantId,
      deletedAt: null, // Soft delete filter
      ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters?.licenseType ? { licenseType: filters.licenseType } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { vendor: { name: { contains: params.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, licenses] = await Promise.all([
      prisma.license.count({ where }),
      prisma.license.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: {
          vendor: { select: { id: true, name: true } },
          _count: {
            select: {
              allocations: { where: { revokedAt: null } },
              assetLicenses: true,
            },
          },
        },
      }),
    ]);

    // Format output with computed available seats
    const formatted = licenses.map((l) => {
      const allocatedSeats = l._count.allocations;
      const availableSeats = l.licenseType === 'site' || l.licenseType === 'open_source'
        ? 999999
        : Math.max(0, l.totalSeats - allocatedSeats);

      return {
        ...l,
        allocatedSeats,
        availableSeats,
        linkedAssetCount: l._count.assetLicenses,
      };
    });

    return { total, licenses: formatted };
  }

  async findById(tenantId: string, id: string) {
    const license = await prisma.license.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vendor: true,
        allocations: {
          where: { revokedAt: null },
          include: {
            user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          },
        },
        assetLicenses: {
          include: {
            asset: { select: { id: true, name: true, assetType: true } },
          },
        },
      },
    });

    if (!license) return null;

    const allocatedSeats = license.allocations.length;
    const availableSeats = license.licenseType === 'site' || license.licenseType === 'open_source'
      ? 999999
      : Math.max(0, license.totalSeats - allocatedSeats);

    return {
      ...license,
      allocatedSeats,
      availableSeats,
    };
  }

  async create(data: Prisma.LicenseCreateInput) {
    return prisma.license.create({ data });
  }

  async update(id: string, data: Prisma.LicenseUpdateInput) {
    return prisma.license.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.license.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const licenseRepository = new LicenseRepository();
