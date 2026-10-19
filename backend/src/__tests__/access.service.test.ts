import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma';
import { accessRepository } from '../repositories/access.repository';
import { accessService } from '../services/access.service';

describe('asset checkout lifecycle state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['DRAFT', 'ARCHIVED'])('checkout preserves an asset in %s status', async (status) => {
    const asset = { id: 'asset-id', status };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      asset: {
        findFirst: vi.fn().mockResolvedValue(asset),
        update: vi.fn(),
      },
      assetAccessLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      ((callback: (client: typeof tx) => unknown) => callback(tx)) as any
    );
    vi.spyOn(accessRepository, 'verifyUserSeatCoverage').mockResolvedValue(true);

    const result = await accessService.checkoutAsset('tenant-id', asset.id, 'user-id');

    expect(result.asset).toBe(asset);
    expect(result.asset.status).toBe(status);
    expect(tx.asset.update).not.toHaveBeenCalled();
  });

  it('check-in preserves an archived asset status', async () => {
    const asset = { id: 'asset-id', status: 'ARCHIVED' };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      asset: {
        findFirst: vi.fn().mockResolvedValue(asset),
        update: vi.fn(),
      },
      assetAccessLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      ((callback: (client: typeof tx) => unknown) => callback(tx)) as any
    );

    const result = await accessService.checkinAsset('tenant-id', asset.id, 'user-id');

    expect(result.asset).toBe(asset);
    expect(result.asset.status).toBe('ARCHIVED');
    expect(tx.asset.update).not.toHaveBeenCalled();
  });
});
