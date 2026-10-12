import { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service';
import { getPaginationParams } from '../../utils/pagination.util';
import { sendResponse } from '../../utils/response.util';

export class AuditController {
  async listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const params = getPaginationParams(req, 'createdAt');
      const action = req.query.action as string | undefined;
      const entityType = req.query.entityType as string | undefined;

      const result = await auditService.listLogs(tenantId, params, action, entityType);
      sendResponse(res, 200, result.logs, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
