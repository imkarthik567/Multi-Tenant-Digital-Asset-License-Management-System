import { prisma } from '../../config/database';
import { AllocateSeatInput } from './allocation.schema';
import { BadRequestError, NotFoundError, ConflictError } from '../../errors/AppError';
import { PaginationParams, createPaginationMeta } from '../../utils/pagination.util';

export class AllocationService {
  async listAllocations(tenantId: string, params: PaginationParams, licenseId?: string, userId?: string) {
    const where = {
      license: { tenantId, deletedAt: null },
      ...(licenseId ? { licenseId } : {}),
      ...(userId ? { userId } : {}),
    };

    const [total, allocations] = await Promise.all([
      prisma.licenseAllocation.count({ where }),
      prisma.licenseAllocation.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { allocatedAt: 'desc' },
        include: {
          license: {
            select: {
              id: true,
              name: true,
              licenseType: true,
              totalSeats: true,
              vendor: { select: { name: true } },
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    return {
      allocations,
      meta: createPaginationMeta(total, params.page, params.limit),
    };
  }

  async allocateSeat(tenantId: string, input: AllocateSeatInput, actorUserId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify license belongs to tenant and is active
      const license = await tx.license.findFirst({
        where: { id: input.licenseId, tenantId, deletedAt: null },
        include: {
          _count: {
            select: { allocations: { where: { revokedAt: null } } },
          },
        },
      });

      if (!license) {
        throw new NotFoundError('License not found in this tenant organization');
      }

      if (license.status !== 'active') {
        throw new BadRequestError(`Cannot allocate seat: License is currently "${license.status}"`);
      }

      // 2. Verify target user belongs to tenant and is active
      const targetUser = await tx.user.findFirst({
        where: { id: input.userId, tenantId, isActive: true },
      });

      if (!targetUser) {
        throw new NotFoundError('Target user not found or is currently inactive in this tenant');
      }

      // 3. Verify user does not already have an active seat for this license
      const existingActive = await tx.licenseAllocation.findFirst({
        where: {
          licenseId: input.licenseId,
          userId: input.userId,
          revokedAt: null,
        },
      });

      if (existingActive) {
        throw new ConflictError(
          `User "${targetUser.fullName}" already holds an active seat for license "${license.name}"`
        );
      }

      // 4. Verify seat capacity
      const activeCount = license._count.allocations;
      if (
        license.licenseType !== 'site' &&
        license.licenseType !== 'open_source' &&
        activeCount >= license.totalSeats
      ) {
        throw new BadRequestError(
          `License "${license.name}" has reached full seat capacity (${activeCount}/${license.totalSeats} seats active)`
        );
      }

      // 5. Create allocation record
      const allocation = await tx.licenseAllocation.create({
        data: {
          licenseId: input.licenseId,
          userId: input.userId,
          notes: input.notes,
        },
        include: {
          license: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      });

      // 6. Record audit log
      if (actorUserId) {
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorUserId,
            entityType: 'LicenseAllocation',
            entityId: allocation.id,
            action: 'ALLOCATE',
            newValues: {
              licenseName: license.name,
              allocatedTo: targetUser.email,
              notes: input.notes,
            },
          },
        });
      }

      return allocation;
    });
  }

  async revokeSeat(tenantId: string, allocationId: string, reason?: string, actorUserId?: string) {
    return prisma.$transaction(async (tx) => {
      const allocation = await tx.licenseAllocation.findUnique({
        where: { id: allocationId },
        include: {
          license: { select: { id: true, name: true, tenantId: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (!allocation || allocation.license.tenantId !== tenantId) {
        throw new NotFoundError('Seat allocation record not found');
      }

      if (allocation.revokedAt !== null) {
        throw new BadRequestError('This license seat allocation has already been revoked');
      }

      const revoked = await tx.licenseAllocation.update({
        where: { id: allocationId },
        data: {
          revokedAt: new Date(),
          notes: reason ? `${allocation.notes || ''} [Revocation Reason: ${reason}]`.trim() : allocation.notes,
        },
      });

      if (actorUserId) {
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: actorUserId,
            entityType: 'LicenseAllocation',
            entityId: allocationId,
            action: 'REVOKE',
            oldValues: {
              licenseName: allocation.license.name,
              userEmail: allocation.user.email,
            },
            newValues: { revokedAt: revoked.revokedAt, reason },
          },
        });
      }

      return revoked;
    });
  }
}

export const allocationService = new AllocationService();
