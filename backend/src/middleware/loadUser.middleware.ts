// ==============================================================================
// AssetVault: Dynamic User Hydration Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Re-queries database on every request to immediately reflect deactivations or role updates
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { prismaForRequest } from '../config/prisma';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { RoleName, getPermissionsForRole } from '../config/permissions';

export const loadUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.jwtUser?.sub) {
      throw new UnauthorizedError('Authentication token payload missing');
    }

    // Always fetch fresh user state from PostgreSQL with tenant context
    const isSuperAdmin = Boolean(req.jwtUser.isSuperAdmin || req.jwtUser.role === 'SUPER_ADMIN');
    const userPrisma =
      req.prisma ||
      prismaForRequest({
        tenantId: req.jwtUser.tenantId,
        userId: req.jwtUser.sub,
        isSuperAdmin,
      });

    const user = await userPrisma.user.findUnique({
      where: { id: req.jwtUser.sub },
      include: {
        role: true,
        tenant: {
          include: { plan: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found or removed');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account has been deactivated. Please contact your administrator.');
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw new ForbiddenError('Organization tenant is suspended. Access blocked.');
    }

    const roleName = user.role.name as RoleName;

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin: roleName === 'SUPER_ADMIN',
      permissions: getPermissionsForRole(roleName),
      tenant: user.tenant,
    };

    if (user.tenant) {
      req.tenant = {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
};
