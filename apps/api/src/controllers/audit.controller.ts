// ==============================================================================
// AssetVault: Audit Log HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { auditService } from '../services/audit.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';
import { AuditAction } from '@prisma/client';

export class AuditController {
  public listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'performed_at', ['performed_at', 'table_name', 'action']);
    const filter = {
      tableName: req.query.tableName as string,
      action: req.query.action as AuditAction,
      userId: req.query.userId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    const result = await auditService.listAuditLogs(
      req.prisma,
      req.user!.tenantId!,
      params,
      filter
    );

    sendResponse(res, 200, result.data, result.meta);
  });

  public getDiff = asyncHandler(async (req: Request, res: Response) => {
    const diff = await auditService.getAuditDiff(req.prisma, req.user!.tenantId as string, req.params.id as string);
    sendResponse(res, 200, diff);
  });
}

export const auditController = new AuditController();
