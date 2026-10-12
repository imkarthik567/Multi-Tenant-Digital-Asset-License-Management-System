import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { prisma } from '../config/database';

export const tenantScope = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required prior to tenant scoping');
    }

    // Determine target tenant ID
    const requestedTenantId =
      (req.headers['x-tenant-id'] as string) ||
      req.params.tenantId ||
      req.user.tenantId;

    // Strict Tenant Isolation: Non-superadmins CANNOT query or operate on other tenants
    if (!req.user.isSuperAdmin && requestedTenantId !== req.user.tenantId) {
      throw new ForbiddenError('Tenant isolation violation: Access across tenant boundaries is strictly forbidden');
    }

    // Fetch tenant details to attach context
    const tenant = await prisma.tenant.findUnique({
      where: { id: requestedTenantId },
      select: { id: true, name: true, slug: true, status: true },
    });

    if (!tenant) {
      throw new ForbiddenError('Target tenant organization does not exist');
    }

    if (tenant.status === 'suspended') {
      throw new ForbiddenError('Tenant organization account is currently suspended');
    }

    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    };

    next();
  } catch (error) {
    next(error);
  }
};
