import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { getPaginationParams } from '../../utils/pagination.util';
import { sendResponse } from '../../utils/response.util';

export class UserController {
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const params = getPaginationParams(req, 'createdAt');
      const roleFilter = req.query.role as string | undefined;

      const result = await userService.listUsers(tenantId, params, roleFilter);
      sendResponse(res, 200, result.users, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const user = await userService.createUser(tenantId, req.body, req.user?.id);
      sendResponse(res, 201, user);
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.params.id as string;
      const updated = await userService.updateUser(tenantId, userId, req.body, req.user?.id);
      sendResponse(res, 200, updated);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
