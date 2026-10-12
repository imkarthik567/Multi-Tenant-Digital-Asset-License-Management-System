import { prisma } from '../../config/database';
import { CreateUserInput, UpdateUserInput } from './user.schema';
import { hashPassword } from '../../utils/hash.util';
import { ConflictError, NotFoundError } from '../../errors/AppError';
import { PaginationParams, createPaginationMeta } from '../../utils/pagination.util';
import { Prisma } from '@prisma/client';

export class UserService {
  async listUsers(tenantId: string, params: PaginationParams, roleFilter?: string) {
    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(roleFilter ? { role: { name: roleFilter } } : {}),
      ...(params.q
        ? {
            OR: [
              { fullName: { contains: params.q, mode: 'insensitive' } },
              { email: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          role: {
            select: { id: true, name: true, description: true },
          },
          _count: {
            select: {
              licenseAllocations: { where: { revokedAt: null } },
              createdAssets: true,
            },
          },
        },
      }),
    ]);

    return {
      users,
      meta: createPaginationMeta(total, params.page, params.limit),
    };
  }

  async createUser(tenantId: string, input: CreateUserInput, actorUserId?: string) {
    const email = input.email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: {
        uq_users_tenant_email: {
          tenantId,
          email,
        },
      },
    });

    if (existing) {
      throw new ConflictError(`User with email "${email}" already exists in this tenant`);
    }

    const role = await prisma.role.findUnique({
      where: { name: input.roleName },
    });
    if (!role) {
      throw new NotFoundError(`Role "${input.roleName}" not found`);
    }

    const defaultPassword = input.password || 'Password123!';
    const passwordHash = await hashPassword(defaultPassword);

    const user = await prisma.user.create({
      data: {
        tenantId,
        roleId: role.id,
        email,
        passwordHash,
        fullName: input.fullName,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'User',
          entityId: user.id,
          action: 'CREATE',
          newValues: { email: user.email, role: input.roleName },
        },
      });
    }

    return user;
  }

  async updateUser(tenantId: string, userId: string, input: UpdateUserInput, actorUserId?: string) {
    const existing = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { role: true },
    });

    if (!existing) {
      throw new NotFoundError('User not found in this tenant');
    }

    let roleId = existing.roleId;
    if (input.roleName && input.roleName !== existing.role.name) {
      const role = await prisma.role.findUnique({ where: { name: input.roleName } });
      if (!role) throw new NotFoundError(`Role "${input.roleName}" not found`);
      roleId = role.id;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        roleId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    if (actorUserId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          entityType: 'User',
          entityId: userId,
          action: 'UPDATE',
          oldValues: { fullName: existing.fullName, role: existing.role.name, isActive: existing.isActive },
          newValues: updated,
        },
      });
    }

    return updated;
  }
}

export const userService = new UserService();
