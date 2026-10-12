import { Request, Response, NextFunction } from 'express';
import { licenseService } from './license.service';
import { getPaginationParams } from '../../utils/pagination.util';
import { sendResponse } from '../../utils/response.util';

export class LicenseController {
  async listLicenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const params = getPaginationParams(req, 'createdAt');
      const filters = {
        vendorId: req.query.vendorId as string | undefined,
        licenseType: req.query.licenseType as string | undefined,
        status: req.query.status as string | undefined,
      };

      const result = await licenseService.listLicenses(tenantId, params, filters);
      sendResponse(res, 200, result.licenses, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getLicenseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const licenseId = req.params.id as string;
      const license = await licenseService.getLicenseById(tenantId, licenseId);
      sendResponse(res, 200, license);
    } catch (error) {
      next(error);
    }
  }

  async createLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const license = await licenseService.createLicense(tenantId, req.body, req.user?.id);
      sendResponse(res, 201, license);
    } catch (error) {
      next(error);
    }
  }

  async updateLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const licenseId = req.params.id as string;
      const license = await licenseService.updateLicense(tenantId, licenseId, req.body, req.user?.id);
      sendResponse(res, 200, license);
    } catch (error) {
      next(error);
    }
  }

  async deleteLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const licenseId = req.params.id as string;
      await licenseService.deleteLicense(tenantId, licenseId, req.user?.id);
      sendResponse(res, 200, { message: 'License successfully soft-deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const licenseController = new LicenseController();
