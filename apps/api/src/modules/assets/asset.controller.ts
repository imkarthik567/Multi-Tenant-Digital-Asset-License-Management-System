import { Request, Response, NextFunction } from 'express';
import { assetService } from './asset.service';
import { getPaginationParams } from '../../utils/pagination.util';
import { sendResponse } from '../../utils/response.util';

export class AssetController {
  async listAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const params = getPaginationParams(req, 'createdAt');
      const filters = {
        categoryId: req.query.categoryId as string | undefined,
        assetType: req.query.assetType as string | undefined,
        tagId: req.query.tagId as string | undefined,
      };

      const result = await assetService.listAssets(tenantId, params, filters);
      sendResponse(res, 200, result.assets, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getAssetById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const assetId = req.params.id as string;
      const asset = await assetService.getAssetById(tenantId, assetId);
      sendResponse(res, 200, asset);
    } catch (error) {
      next(error);
    }
  }

  async createAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const asset = await assetService.createAsset(tenantId, req.body, req.user?.id);
      sendResponse(res, 201, asset);
    } catch (error) {
      next(error);
    }
  }

  async updateAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const assetId = req.params.id as string;
      const asset = await assetService.updateAsset(tenantId, assetId, req.body, req.user?.id);
      sendResponse(res, 200, asset);
    } catch (error) {
      next(error);
    }
  }

  async deleteAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const assetId = req.params.id as string;
      await assetService.deleteAsset(tenantId, assetId, req.user?.id);
      sendResponse(res, 200, { message: 'Asset successfully soft-deleted' });
    } catch (error) {
      next(error);
    }
  }

  async logAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const assetId = req.params.id as string;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const log = await assetService.recordAccessLog(
        tenantId,
        assetId,
        req.body.action,
        req.user?.id,
        ip,
        userAgent
      );
      sendResponse(res, 201, log);
    } catch (error) {
      next(error);
    }
  }
}

export const assetController = new AssetController();
