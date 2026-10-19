import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma';
import { assetRepository } from '../repositories/asset.repository';
import { assetService } from '../services/asset.service';

describe('asset creation uniqueness races', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a conflict when concurrent asset creation hits the unique code constraint', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      asset: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      ((callback: (client: typeof tx) => unknown) => callback(tx)) as any
    );
    vi.spyOn(assetRepository, 'create').mockRejectedValue({ code: 'P2002' } as any);

    await expect(
      assetService.createAsset(prisma, 'tenant-id', 'owner-id', {
        name: 'Concurrent asset',
        assetCode: 'ASSET-RACE-1',
        assetType: 'SOFTWARE',
      })
    ).rejects.toThrow("Asset with code 'ASSET-RACE-1' already exists.");
  });

  it('returns a conflict when a concurrent CSV import hits the unique code constraint', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      asset: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      ((callback: (client: typeof tx) => unknown) => callback(tx)) as any
    );

    await expect(
      assetService.bulkImport(
        'tenant-id',
        'user-id',
        'name,asset_code,asset_type\nConcurrent asset,ASSET-RACE-2,SOFTWARE'
      )
    ).rejects.toThrow("Duplicate asset code 'ASSET-RACE-2' encountered at database stage.");
  });
});
