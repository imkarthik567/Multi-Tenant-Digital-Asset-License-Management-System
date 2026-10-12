import { Request, Response, NextFunction } from 'express';
import { vendorService } from './vendor.service';
import { getPaginationParams } from '../../utils/pagination.util';
import { sendResponse } from '../../utils/response.util';

export class VendorController {
  async listVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const params = getPaginationParams(req, 'name');
      const result = await vendorService.listVendors(tenantId, params);
      sendResponse(res, 200, result.vendors, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getVendorById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const vendorId = req.params.id as string;
      const vendor = await vendorService.getVendorById(tenantId, vendorId);
      sendResponse(res, 200, vendor);
    } catch (error) {
      next(error);
    }
  }

  async createVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const vendor = await vendorService.createVendor(tenantId, req.body, req.user?.id);
      sendResponse(res, 201, vendor);
    } catch (error) {
      next(error);
    }
  }

  async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const vendorId = req.params.id as string;
      const vendor = await vendorService.updateVendor(tenantId, vendorId, req.body, req.user?.id);
      sendResponse(res, 200, vendor);
    } catch (error) {
      next(error);
    }
  }

  async deleteVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const vendorId = req.params.id as string;
      await vendorService.deleteVendor(tenantId, vendorId, req.user?.id);
      sendResponse(res, 200, { message: 'Vendor successfully removed' });
    } catch (error) {
      next(error);
    }
  }
}

export const vendorController = new VendorController();
