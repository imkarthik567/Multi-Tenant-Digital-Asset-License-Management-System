import { prisma } from '../../config/database';
import { UpdateTenantInput } from './tenant.schema';
import { NotFoundError } from '../../errors/AppError';

export class TenantService {
  async getTenant(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            assets: true,
            licenses: true,
            vendors: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant organization not found');
    }
    return tenant;
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput, userId?: string) {
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      throw new NotFoundError('Tenant organization not found');
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: input,
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'Tenant',
          entityId: tenantId,
          action: 'UPDATE',
          oldValues: existing,
          newValues: updated,
        },
      });
    }

    return updated;
  }

  async listAllTenants() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            assets: true,
            licenses: true,
          },
        },
      },
    });
  }
}

export const tenantService = new TenantService();
