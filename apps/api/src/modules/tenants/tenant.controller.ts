import { Request, Response, NextFunction } from 'express';
import { tenantService } from './tenant.service';
import { sendResponse } from '../../utils/response.util';

export class TenantController {
  async getTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const tenant = await tenantService.getTenant(tenantId);
      sendResponse(res, 200, tenant);
    } catch (error) {
      next(error);
    }
  }

  async updateTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const updated = await tenantService.updateTenant(tenantId, req.body, req.user?.id);
      sendResponse(res, 200, updated);
    } catch (error) {
      next(error);
    }
  }

  async listAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenants = await tenantService.listAllTenants();
      sendResponse(res, 200, tenants);
    } catch (error) {
      next(error);
    }
  }
}

export const tenantController = new TenantController();
