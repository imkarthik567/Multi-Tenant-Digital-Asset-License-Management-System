// ==============================================================================
// AssetVault: User Directory Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response, NextFunction } from 'express';

export class UserController {
  public async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await req.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          avatarUrl: true,
          role: { select: { id: true, name: true, description: true } },
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        status: 'success',
        results: users.length,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
