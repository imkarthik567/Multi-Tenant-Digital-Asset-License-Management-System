// ==============================================================================
// AssetVault: Asset HTTP Controllers
// Course: BCSE307L Database Systems (Fall 2026-27)
// Operates strictly through req.prisma (tenant-aware client extension)
// Cross-tenant access returns 404 Not Found
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/AppError';

export class AssetController {
  public async listAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, type } = req.query as { query?: string; type?: any };

      const where: any = {
        deletedAt: null,
      };

      if (query) {
        // Safe parameterized search
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { assetCode: { contains: query, mode: 'insensitive' } },
        ];
      }

      if (type) {
        where.assetType = type;
      }

      const assets = await req.prisma.asset.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          owner: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        status: 'success',
        results: assets.length,
        data: assets,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getAssetById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await req.prisma.asset.findFirst({
        where: {
          id: req.params.id,
          deletedAt: null,
        },
        include: {
          category: { select: { id: true, name: true } },
          owner: { select: { id: true, fullName: true, email: true } },
          versions: { orderBy: { versionNo: 'desc' } },
        },
      });

      // Strict requirement: Cross-tenant lookup returns 404 (never 403)
      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      res.status(200).json({
        status: 'success',
        data: asset,
      });
    } catch (error) {
      next(error);
    }
  }

  public async createAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asset = await req.prisma.asset.create({
        data: {
          name: req.body.name,
          assetCode: req.body.assetCode,
          assetType: req.body.assetType,
          description: req.body.description,
          categoryId: req.body.categoryId,
          ownerId: req.user!.id,
        },
      });

      res.status(201).json({
        status: 'success',
        data: asset,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const assetController = new AssetController();
