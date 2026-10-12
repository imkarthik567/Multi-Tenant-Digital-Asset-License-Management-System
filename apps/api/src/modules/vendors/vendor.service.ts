import { prisma } from '../../config/database';
import { CreateVendorInput, UpdateVendorInput } from './vendor.schema';
import { ConflictError, NotFoundError } from '../../errors/AppError';
import { PaginationParams, createPaginationMeta } from '../../utils/pagination.util';
import { Prisma } from '@prisma/client';

export class VendorService {
  async listVendors(tenantId: string, params: PaginationParams) {
    const where: Prisma.VendorWhereInput = {
      tenantId,
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { contactEmail: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, vendors] = await Promise.all([
      prisma.vendor.count({ where }),
      prisma.vendor.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: {
          _count: { select: { licenses: { where: { deletedAt: null } } } },
        },
      }),
    ]);

    return {
      vendors,
      meta: createPaginationMeta(total, params.page, params.limit),
    };
  }

  async getVendorById(tenantId: string, vendorId: string) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, tenantId },
      include: {
        licenses: {
          where: { deletedAt: null },
          select: { id: true, name: true, licenseType: true, totalSeats: true, cost: true, status: true },
        },
      },
    });

    if (!vendor) throw new NotFoundError('Vendor not found');
    return vendor;
  }

  async createVendor(tenantId: string, input: CreateVendorInput, actorUserId?: string) {
    const existing = await prisma.vendor.findUnique({
      where: { uq_vendors_tenant_name: { tenantId, name: input.name } },
    });
    if (existing) {
      throw new ConflictError(`Vendor "${input.name}" already exists in this tenant organization`);
    }

    const vendor = await prisma.vendor.create({
      data: {
        tenantId,
        name: input.name,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        websiteUrl: input.websiteUrl,
        address: input.address,
      },
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Vendor',
          entityId: vendor.id,
          action: 'CREATE',
          newValues: { name: vendor.name },
        },
      });
    }

    return vendor;
  }

  async updateVendor(tenantId: string, vendorId: string, input: UpdateVendorInput, actorUserId?: string) {
    const existing = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId } });
    if (!existing) throw new NotFoundError('Vendor not found');

    const updated = await prisma.vendor.update({
      where: { id: vendorId },
      data: input,
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Vendor',
          entityId: vendorId,
          action: 'UPDATE',
          oldValues: { name: existing.name },
          newValues: input,
        },
      });
    }

    return updated;
  }

  async deleteVendor(tenantId: string, vendorId: string, actorUserId?: string) {
    const existing = await prisma.vendor.findFirst({
      where: { id: vendorId, tenantId },
      include: { _count: { select: { licenses: { where: { deletedAt: null } } } } },
    });

    if (!existing) throw new NotFoundError('Vendor not found');
    if (existing._count.licenses > 0) {
      throw new ConflictError('Cannot delete vendor with active associated licenses');
    }

    await prisma.vendor.delete({ where: { id: vendorId } });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'Vendor',
          entityId: vendorId,
          action: 'DELETE',
          oldValues: { name: existing.name },
        },
      });
    }
  }
}

export const vendorService = new VendorService();
