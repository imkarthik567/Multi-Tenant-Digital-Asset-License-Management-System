import { prisma } from '../../config/database';
import { PaginationParams, createPaginationMeta } from '../../utils/pagination.util';
import { Prisma } from '@prisma/client';

export class AuditService {
  async listLogs(tenantId: string, params: PaginationParams, action?: string, entityType?: string) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        },
      }),
    ]);

    return {
      logs,
      meta: createPaginationMeta(total, params.page, params.limit),
    };
  }
}

export const auditService = new AuditService();
