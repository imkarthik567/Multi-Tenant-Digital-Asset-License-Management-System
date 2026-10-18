import { afterEach, describe, expect, it, vi } from 'vitest';
import { licenseRepository } from '../repositories/license.repository';
import { licenseService } from '../services/license.service';

describe('license partial date updates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const id = '00000000-0000-4000-8000-000000000041';
  const tenantId = '00000000-0000-4000-8000-000000000042';
  const lockedDateRows = [{ start_date: new Date('2026-01-01'), end_date: new Date('2026-01-31') }];

  it('validates the stored end date when a partial update advances startDate', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue(lockedDateRows),
    };
    const prismaClient = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    vi.spyOn(licenseRepository, 'findById').mockResolvedValue({ id, tenantId } as any);
    const updateSpy = vi.spyOn(licenseRepository, 'update').mockResolvedValue({ id } as any);

    await expect(
      licenseService.updateLicense(
        prismaClient,
        id,
        { startDate: new Date('2026-02-01') },
        { tenantId, userId: 'user-id' }
      )
    ).rejects.toThrow('End date must be after start date');

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('allows a partial update to clear the stored end date explicitly', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue(lockedDateRows),
    };
    const prismaClient = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    vi.spyOn(licenseRepository, 'findById').mockResolvedValue({ id, tenantId } as any);
    const updated = { id, startDate: new Date('2026-02-01'), endDate: null };
    const updateSpy = vi.spyOn(licenseRepository, 'update').mockResolvedValue(updated as any);

    await expect(
      licenseService.updateLicense(
        prismaClient,
        id,
        { startDate: updated.startDate, endDate: null },
        { tenantId, userId: 'user-id' }
      )
    ).resolves.toBe(updated);

    expect(updateSpy).toHaveBeenCalledWith(tx, id, expect.objectContaining({ endDate: null }));
  });
});

describe('license seat-capacity updates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects reducing totalSeats below active allocations while holding the license row lock', async () => {
    const id = '00000000-0000-4000-8000-000000000010';
    const tenantId = '00000000-0000-4000-8000-000000000020';
    const lockedRows = [{ start_date: new Date('2026-01-01'), end_date: null }];
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn()
        .mockResolvedValueOnce(lockedRows)
        .mockResolvedValueOnce([{ active_count: 2 }]),
    };
    const prismaClient = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    vi.spyOn(licenseRepository, 'findById').mockResolvedValue({
      id,
      tenantId,
      startDate: new Date('2026-01-01'),
      endDate: null,
    } as any);
    const updateSpy = vi.spyOn(licenseRepository, 'update').mockResolvedValue({ id } as any);

    await expect(
      licenseService.updateLicense(prismaClient, id, { totalSeats: 1 }, { tenantId, userId: 'user-id' })
    ).rejects.toThrow('Cannot reduce total seats below the 2 active allocation(s).');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('allows a seat limit that remains at or above active allocations', async () => {
    const id = '00000000-0000-4000-8000-000000000011';
    const tenantId = '00000000-0000-4000-8000-000000000021';
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ start_date: new Date('2026-01-01'), end_date: null }])
        .mockResolvedValueOnce([{ active_count: 2 }]),
    };
    const prismaClient = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    vi.spyOn(licenseRepository, 'findById').mockResolvedValue({
      id,
      tenantId,
      startDate: new Date('2026-01-01'),
      endDate: null,
    } as any);
    const updated = { id, totalSeats: 2 };
    const updateSpy = vi.spyOn(licenseRepository, 'update').mockResolvedValue(updated as any);

    await expect(
      licenseService.updateLicense(prismaClient, id, { totalSeats: 2 }, { tenantId, userId: 'user-id' })
    ).resolves.toBe(updated);

    expect(updateSpy).toHaveBeenCalledOnce();
  });
});

describe('license asset links', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a conflict when concurrent duplicate links hit the unique constraint', async () => {
    const assetId = '00000000-0000-4000-8000-000000000030';
    const licenseId = '00000000-0000-4000-8000-000000000031';
    const prismaClient = {
      asset: { findFirst: vi.fn().mockResolvedValue({ id: assetId }) },
      license: { findFirst: vi.fn().mockResolvedValue({ id: licenseId }) },
      assetLicense: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    vi.spyOn(licenseRepository, 'linkAsset').mockRejectedValue({ code: 'P2002' } as any);

    await expect(licenseService.linkAsset(prismaClient, assetId, licenseId))
      .rejects.toThrow('Asset is already covered by this license.');
  });
});
