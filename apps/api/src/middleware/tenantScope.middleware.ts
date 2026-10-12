// ==============================================================================
// AssetVault: Tenant Context & Isolation Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Binds tenant-aware Prisma client extension with RLS session context variables
// Cross-tenant ID probing returns 404 (never 403) to prevent ID enumeration
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { NotFoundError, UnauthorizedError } from '../errors/AppError';
import { prismaForRequest } from '../config/prisma';

export const tenantContext = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required prior to tenant scoping');
  }

  // Probe prevention: If caller explicitly passes a foreign tenant ID, return 404 (never 403)
  const requestedTenantId =
    (req.headers['x-tenant-id'] as string) || req.params.tenantId || req.user.tenantId;

  if (!req.user.isSuperAdmin && requestedTenantId && requestedTenantId !== req.user.tenantId) {
    throw new NotFoundError('Organization resource not found');
  }

  // Bind tenant-aware Prisma client extension with PostgreSQL session context
  req.prisma = prismaForRequest({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    isSuperAdmin: req.user.isSuperAdmin,
  });

  if (req.user.tenant) {
    req.tenant = {
      id: req.user.tenant.id,
      name: req.user.tenant.name,
      slug: req.user.tenant.slug,
    };
  }

  next();
};

export const tenantScope = tenantContext;
