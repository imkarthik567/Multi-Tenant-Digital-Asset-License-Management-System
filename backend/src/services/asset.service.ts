// ==============================================================================
// AssetVault: Asset & Version Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces atomic version creation and all-or-nothing transactional bulk import
// ==============================================================================

import { assetRepository, AssetFilterOptions } from '../repositories/asset.repository';
import { versionRepository } from '../repositories/version.repository';
import { NotFoundError, ConflictError, BadRequestError, UnprocessableError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { parseCsv, toCsv } from '../utils/csv.util';
import { prisma } from '../config/prisma';
import { AssetType, Prisma } from '@prisma/client';

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export class AssetService {
  public async listAssets(
    prismaClient: any,
    tenantId: string,
    params: PaginationParams,
    filter: AssetFilterOptions
  ) {
    const { data, total } = await assetRepository.findCatalog(prismaClient, tenantId, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getAssetById(prismaClient: any, id: string) {
    const asset = await assetRepository.findById(prismaClient, id);
    if (!asset) {
      throw new NotFoundError('Asset not found');
    }

    // Asset detail records come from the Prisma model, while list records come
    // from v_asset_catalog. Include the canonical computed compliance fields in
    // the detail response too, rather than letting the UI default to UNLICENSED.
    const catalogCompliance = await assetRepository.findCatalogCompliance(
      prismaClient,
      id,
      asset.tenantId
    );

    return {
      ...asset,
      complianceStatus: catalogCompliance?.compliance_status ?? 'UNLICENSED',
      coveringLicensesCount: Number(catalogCompliance?.covering_licenses_count ?? 0),
    };
  }

  public async createAsset(_prismaClient: any, tenantId: string, ownerId: string, data: any) {
    if (data.fileUrl && !/^[a-fA-F0-9]{64}$/.test(data.checksumSha256 || '')) {
      throw new BadRequestError('A valid SHA-256 checksum is required when a file URL is provided.');
    }

    // Asset metadata, its initial file version, and tags form one logical
    // create operation. Keep all writes in one transaction so a failed
    // version or tag insert cannot leave a partially created asset.
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${ownerId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      // Asset codes remain unique after soft deletion, matching the database's
      // (tenant_id, asset_code) unique constraint.
      const existing = await tx.asset.findFirst({
        where: { assetCode: data.assetCode, tenantId },
      });
      if (existing) {
        throw new ConflictError(`Asset with code '${data.assetCode}' already exists.`);
      }

      let asset;
      try {
        asset = await assetRepository.create(tx, {
          name: data.name,
          assetCode: data.assetCode,
          assetType: data.assetType,
          description: data.description || null,
          status: (data.status as any) || 'ACTIVE',
          category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
          owner: { connect: { id: ownerId } },
          tenant: { connect: { id: tenantId } },
        });
      } catch (error) {
        // The pre-check above cannot prevent a concurrent create from winning
        // between the check and insert. Preserve the API's conflict semantics.
        if (isUniqueConstraintViolation(error)) {
          throw new ConflictError(`Asset with code '${data.assetCode}' already exists.`);
        }
        throw error;
      }

      if (data.fileUrl) {
        await tx.assetVersion.create({
          data: {
            assetId: asset.id,
            versionNo: 1,
            fileUrl: data.fileUrl,
            fileSizeBytes: BigInt(data.fileSizeBytes || 1048576),
            checksumSha256: data.checksumSha256,
            uploadedBy: ownerId,
          },
        });
      }

      if (Array.isArray(data.tags) && data.tags.length > 0) {
        for (const tagItem of data.tags) {
          if (!tagItem || typeof tagItem !== 'string' || !tagItem.trim()) continue;
          const tagName = tagItem.trim();
          const tag = await tx.tag.upsert({
            where: { tenantId_name: { tenantId, name: tagName } },
            create: { tenantId, name: tagName },
            update: {},
          });
          await assetRepository.attachTag(tx, asset.id, tag.id);
        }
      }

      return asset;
    });
  }

  public async updateAsset(prismaClient: any, id: string, data: any) {
    await this.getAssetById(prismaClient, id);
    return assetRepository.update(prismaClient, id, {
      name: data.name,
      assetType: data.assetType,
      description: data.description,
      status: data.status,
      category:
        data.categoryId === null
          ? { disconnect: true }
          : data.categoryId
          ? { connect: { id: data.categoryId } }
          : undefined,
    });
  }

  public async softDeleteAsset(prismaClient: any, id: string) {
    await this.getAssetById(prismaClient, id);
    return assetRepository.softDelete(prismaClient, id);
  }

  public async restoreAsset(prismaClient: any, id: string) {
    const asset = await assetRepository.findById(prismaClient, id, true);
    if (!asset) {
      throw new NotFoundError('Asset not found');
    }
    return assetRepository.restore(prismaClient, id);
  }

  public async attachTags(tenantId: string, userId: string, assetId: string, tagIds: string[]) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const asset = await tx.asset.findFirst({
        where: { id: assetId, deletedAt: null },
        select: { id: true },
      });
      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      const results = [];
      for (const tagId of tagIds) {
        const tag = await tx.tag.findFirst({
          where: { id: tagId, tenantId },
          select: { id: true },
        });
        if (!tag) {
          throw new NotFoundError('Tag not found');
        }
        results.push(await assetRepository.attachTag(tx, assetId, tag.id));
      }
      return results;
    });
  }

  public async detachTag(prismaClient: any, assetId: string, tagId: string) {
    await this.getAssetById(prismaClient, assetId);
    return assetRepository.detachTag(prismaClient, assetId, tagId);
  }

  /**
   * Atomic Asset Version Creation
   * Transaction 2: Safely computes next version number and inserts asset_version
   */
  public async createVersion(tenantId: string, assetId: string, data: any, userId: string) {
    const checksumSha256 = data.checksumSha256 || data.checksum;
    if (!/^[a-fA-F0-9]{64}$/.test(checksumSha256 || '')) {
      throw new BadRequestError('A valid SHA-256 checksum is required for each file version.');
    }

    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      // Serialize version allocation per asset. Without a parent-row lock,
      // concurrent transactions can both observe the same latest version number.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM assets WHERE id = ${assetId}::UUID FOR UPDATE;`);

      const asset = await tx.asset.findFirst({
        where: { id: assetId, deletedAt: null },
      });
      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      const latestVersion = await tx.assetVersion.findFirst({
        where: { assetId },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true },
      });

      const nextVersionNo = (latestVersion?.versionNo || 0) + 1;

      const version = await tx.assetVersion.create({
        data: {
          assetId,
          versionNo: nextVersionNo,
          fileUrl: data.fileUrl,
          fileSizeBytes: BigInt(data.fileSizeBytes || data.fileSize || 1024),
          checksumSha256,
          changeNotes: data.changeNotes || data.changelog || null,
          uploadedBy: userId,
        },
        include: {
          uploader: { select: { id: true, fullName: true, email: true } },
        },
      });

      return version;
    });
  }

  public async listVersions(prismaClient: any, assetId: string) {
    await this.getAssetById(prismaClient, assetId);
    return versionRepository.findByAssetId(prismaClient, assetId);
  }

  public async getVersionByNo(prismaClient: any, assetId: string, versionNo: number) {
    await this.getAssetById(prismaClient, assetId);
    const version = await versionRepository.findByVersionNo(prismaClient, assetId, versionNo);
    if (!version) {
      throw new NotFoundError(`Version ${versionNo} not found for this asset`);
    }
    return version;
  }

  public async compareVersions(prismaClient: any, assetId: string, fromNo: number, toNo: number) {
    await this.getAssetById(prismaClient, assetId);
    const [fromVer, toVer] = await Promise.all([
      versionRepository.findByVersionNo(prismaClient, assetId, fromNo),
      versionRepository.findByVersionNo(prismaClient, assetId, toNo),
    ]);

    if (!fromVer) throw new NotFoundError(`From-version ${fromNo} not found`);
    if (!toVer) throw new NotFoundError(`To-version ${toNo} not found`);

    return {
      assetId,
      from: fromVer,
      to: toVer,
      comparison: {
        versionDelta: toVer.versionNo - fromVer.versionNo,
        sizeDeltaBytes: Number(toVer.fileSizeBytes - fromVer.fileSizeBytes),
        checksumIdentical: toVer.checksumSha256 === fromVer.checksumSha256,
        changeNotes: toVer.changeNotes,
      },
    };
  }

  /**
   * Atomic Bulk CSV Import
   * Transaction 4: Validates row-by-row and rolls back completely if any row fails
   */
  public async bulkImport(tenantId: string, userId: string, csvContent: string) {
    const { rows } = parseCsv(csvContent);
    if (rows.length === 0) {
      throw new BadRequestError('CSV file is empty or missing headers');
    }

    const errors: { row: number; field: string; error: string }[] = [];
    const validRows: any[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // Row 1 is header
      const name = row.name || row.asset_name;
      const assetCode = row.assetCode || row.asset_code;
      const assetType = (row.assetType || row.asset_type)?.toUpperCase() as AssetType;
      const description = row.description || '';

      if (!name || name.trim().length < 2) {
        errors.push({ row: rowNum, field: 'name', error: 'Asset name must be at least 2 characters long' });
      }
      if (!assetCode || assetCode.trim().length < 2) {
        errors.push({ row: rowNum, field: 'assetCode', error: 'Asset code is required' });
      }
      if (!assetType || !['FONT', 'IMAGE', 'VIDEO', 'AUDIO', 'SOFTWARE', 'DATASET', 'DOCUMENT', 'OTHER'].includes(assetType)) {
        errors.push({ row: rowNum, field: 'assetType', error: 'Invalid assetType (must be FONT, IMAGE, VIDEO, AUDIO, SOFTWARE, DATASET, DOCUMENT, or OTHER)' });
      }

      validRows.push({
        name: name?.trim(),
        assetCode: assetCode?.trim(),
        assetType,
        description: description?.trim() || null,
      });
    });

    if (errors.length > 0) {
      throw new UnprocessableError('Bulk import validation failed with errors', {
        totalRows: rows.length,
        errorCount: errors.length,
        errors,
      });
    }

    // Execute atomic insertion in a single transaction
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const createdRecords = [];
      for (const rowData of validRows) {
        // Uniqueness check inside transaction
        const existing = await tx.asset.findFirst({
          where: { assetCode: rowData.assetCode, tenantId },
        });
        if (existing) {
          throw new ConflictError(`Duplicate asset code '${rowData.assetCode}' encountered at database stage.`);
        }

        let created;
        try {
          created = await tx.asset.create({
            data: {
              tenantId,
              ownerId: userId,
              name: rowData.name,
              assetCode: rowData.assetCode,
              assetType: rowData.assetType,
              description: rowData.description,
              status: 'ACTIVE',
            },
          });
        } catch (error) {
          // Concurrent imports can both pass findFirst; map the database
          // uniqueness guard to the same client-facing conflict as the pre-check.
          if (isUniqueConstraintViolation(error)) {
            throw new ConflictError(`Duplicate asset code '${rowData.assetCode}' encountered at database stage.`);
          }
          throw error;
        }
        createdRecords.push(created);
      }

      return {
        success: true,
        importedCount: createdRecords.length,
        assets: createdRecords,
      };
    });
  }

  public async exportCsv(prismaClient: any, tenantId: string): Promise<string> {
    const { data } = await assetRepository.findCatalog(
      prismaClient,
      tenantId,
      { page: 1, limit: 10000, skip: 0, sort: 'name', order: 'asc' },
      {}
    );

    return toCsv(data, [
      'asset_id',
      'asset_code',
      'asset_name',
      'asset_type',
      'asset_status',
      'category_name',
      'owner_name',
      'latest_version_no',
      'compliance_status',
      'created_at',
    ]);
  }
}

export const assetService = new AssetService();
