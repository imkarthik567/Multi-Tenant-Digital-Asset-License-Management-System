import { Request, Response, NextFunction } from 'express';
import { reportService } from './report.service';
import { sendResponse } from '../../utils/response.util';

export class ReportController {
  async getDashboardOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const data = await reportService.getDashboardOverview(tenantId);
      sendResponse(res, 200, data);
    } catch (error) {
      next(error);
    }
  }

  async getLicenseUtilization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const data = await reportService.getLicenseUtilization(tenantId);
      sendResponse(res, 200, data);
    } catch (error) {
      next(error);
    }
  }

  async getExpiringLicenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const data = await reportService.getExpiringLicenses(tenantId);
      sendResponse(res, 200, data);
    } catch (error) {
      next(error);
    }
  }

  async getStorageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const data = await reportService.getStorageStats(tenantId);
      sendResponse(res, 200, data);
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
