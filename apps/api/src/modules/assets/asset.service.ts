import { assetRepository } from './asset.repository';
import { CreateAssetInput, UpdateAssetInput } from './asset.schema';
import { NotFoundError } from '../../errors/AppError';
import { PaginationParams, createPaginationMeta } from '../../utils/pagination.util';
import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class AssetService {
  async listAssets(tenantId: string, params: PaginationParams, filters?: {
    categoryId?: string;
    assetType?: string;
    tagId?: string;
  }) {
    const { total, assets } = await assetRepository.findMany(tenantId, params, filters);
    return {
      assets,
      meta: createPaginationMeta(total, params.page, params.limit),
    };
  }

  async getAssetById(tenantId: string, assetId: string) {
    const asset = await assetRepository.findById(tenantId, assetId);
    if (!asset) {
      throw new NotFoundError('Asset not found');
    }
    return asset;
  }

  async createAsset(tenantId: string, input: CreateAssetInput, userId?: string) {
    // Validate category exists within tenant
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundError('Specified category does not exist in this tenant');
    }

    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          tenant: { connect: { id: tenantId } },
          category: { connect: { id: input.categoryId } },
          name: input.name,
          assetType: input.assetType,
          description: input.description,
          fileUrl: input.fileUrl,
          fileSizeBytes: input.fileSizeBytes ? BigInt(input.fileSizeBytes) : null,
          mimeType: input.mimeType,
          version: input.version,
          metadata: (input.metadata as Prisma.InputJsonValue) || {},
          ...(userId ? { createdByUser: { connect: { id: userId } } } : {}),
        },
      });

      // Bind tags if provided
      if (input.tagIds && input.tagIds.length > 0) {
        await tx.assetTag.createMany({
          data: input.tagIds.map((tagId) => ({
            assetId: asset.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      // Bind licenses if provided
      if (input.licenseIds && input.licenseIds.length > 0) {
        await tx.assetLicense.createMany({
          data: input.licenseIds.map((licenseId) => ({
            assetId: asset.id,
            licenseId,
          })),
          skipDuplicates: true,
        });
      }

      return asset;
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'Asset',
          entityId: created.id,
          action: 'CREATE',
          newValues: { name: created.name, type: created.assetType },
        },
      });
    }

    return this.getAssetById(tenantId, created.id);
  }

  async updateAsset(tenantId: string, assetId: string, input: UpdateAssetInput, userId?: string) {
    const existing = await assetRepository.findById(tenantId, assetId);
    if (!existing) {
      throw new NotFoundError('Asset not found');
    }

    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, tenantId },
      });
      if (!category) throw new NotFoundError('Specified category does not exist in this tenant');
    }

    await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id: assetId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.assetType ? { assetType: input.assetType } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl } : {}),
          ...(input.fileSizeBytes !== undefined ? { fileSizeBytes: input.fileSizeBytes ? BigInt(input.fileSizeBytes) : null } : {}),
          ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
          ...(input.version ? { version: input.version } : {}),
          ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
        },
      });

      // Update tags if passed
      if (input.tagIds) {
        await tx.assetTag.deleteMany({ where: { assetId } });
        if (input.tagIds.length > 0) {
          await tx.assetTag.createMany({
            data: input.tagIds.map((tagId) => ({ assetId, tagId })),
            skipDuplicates: true,
          });
        }
      }

      // Update licenses if passed
      if (input.licenseIds) {
        await tx.assetLicense.deleteMany({ where: { assetId } });
        if (input.licenseIds.length > 0) {
          await tx.assetLicense.createMany({
            data: input.licenseIds.map((licenseId) => ({ assetId, licenseId })),
            skipDuplicates: true,
          });
        }
      }
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'Asset',
          entityId: assetId,
          action: 'UPDATE',
          oldValues: { name: existing.name },
          newValues: JSON.parse(JSON.stringify(input)),
        },
      });
    }

    return this.getAssetById(tenantId, assetId);
  }

  async deleteAsset(tenantId: string, assetId: string, userId?: string) {
    const existing = await assetRepository.findById(tenantId, assetId);
    if (!existing) {
      throw new NotFoundError('Asset not found');
    }

    // Soft delete
    await assetRepository.softDelete(assetId);

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'Asset',
          entityId: assetId,
          action: 'DELETE',
          oldValues: { name: existing.name },
        },
      });
    }
  }

  async recordAccessLog(tenantId: string, assetId: string, action: string, userId?: string, ipAddress?: string, userAgent?: string) {
    const asset = await assetRepository.findById(tenantId, assetId);
    if (!asset) {
      throw new NotFoundError('Asset not found');
    }

    return assetRepository.logAccess(assetId, userId || null, action, ipAddress, userAgent);
  }
}

export const assetService = new AssetService();
