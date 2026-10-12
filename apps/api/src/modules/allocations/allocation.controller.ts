import { Request, Response, NextFunction } from 'express';
import { allocationService } from './allocation.service';
import { getPaginationParams } from '../../utils/pagination.util';
import { sendResponse } from '../../utils/response.util';

export class AllocationController {
  async listAllocations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const params = getPaginationParams(req, 'allocatedAt');
      const licenseId = req.query.licenseId as string | undefined;
      const userId = req.query.userId as string | undefined;

      const result = await allocationService.listAllocations(tenantId, params, licenseId, userId);
      sendResponse(res, 200, result.allocations, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async allocateSeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const allocation = await allocationService.allocateSeat(tenantId, req.body, req.user?.id);
      sendResponse(res, 201, allocation);
    } catch (error) {
      next(error);
    }
  }

  async revokeSeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const allocationId = req.params.id as string;
      const reason = req.body?.reason;
      const revoked = await allocationService.revokeSeat(tenantId, allocationId, reason, req.user?.id);
      sendResponse(res, 200, revoked);
    } catch (error) {
      next(error);
    }
  }
}

export const allocationController = new AllocationController();
