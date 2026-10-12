// ==============================================================================
// AssetVault: Tenant Governance Controller (Super Admin Platform Level)
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response, NextFunction } from 'express';

export class TenantController {
  public async listTenants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenants = await req.prisma.tenant.findMany({
        include: {
          plan: { select: { id: true, name: true, maxUsers: true, maxAssets: true, monthlyPrice: true } },
          _count: { select: { users: true, assets: true, licenses: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        status: 'success',
        results: tenants.length,
        data: tenants,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const tenantController = new TenantController();
