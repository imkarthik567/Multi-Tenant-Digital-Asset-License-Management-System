import { afterEach, describe, expect, it, vi } from 'vitest';
import { userRepository } from '../repositories/user.repository';
import { userService } from '../services/user.service';

describe('user credential and session updates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates account status and revokes refresh sessions in one transaction', async () => {
    const id = '00000000-0000-4000-8000-000000000040';
    const tx = { refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    const prismaClient = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    vi.spyOn(userRepository, 'findById').mockResolvedValue({ id } as any);
    const updated = { id, isActive: false };
    const updateSpy = vi.spyOn(userRepository, 'update').mockResolvedValue(updated as any);

    await expect(userService.updateUserStatus(prismaClient, id, false)).resolves.toBe(updated);

    expect(prismaClient.$transaction).toHaveBeenCalledOnce();
    expect(updateSpy).toHaveBeenCalledWith(tx, id, { isActive: false });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('updates the password and revokes refresh sessions in one transaction', async () => {
    const id = '00000000-0000-4000-8000-000000000041';
    const tx = { refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const prismaClient = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    vi.spyOn(userRepository, 'findById').mockResolvedValue({ id } as any);
    const updated = { id };
    const updateSpy = vi.spyOn(userRepository, 'update').mockResolvedValue(updated as any);

    await expect(userService.resetPassword(prismaClient, id, 'StrongPassword123!')).resolves.toBe(updated);

    expect(prismaClient.$transaction).toHaveBeenCalledOnce();
    expect(updateSpy).toHaveBeenCalledWith(tx, id, { passwordHash: expect.any(String) });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
