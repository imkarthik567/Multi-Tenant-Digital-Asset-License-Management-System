import { Request, Response, NextFunction } from 'express';
import { categoryService } from './category.service';
import { sendResponse } from '../../utils/response.util';

export class CategoryController {
  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const categories = await categoryService.listCategories(tenantId);
      sendResponse(res, 200, categories);
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const category = await categoryService.createCategory(tenantId, req.body, req.user?.id);
      sendResponse(res, 201, category);
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const categoryId = req.params.id as string;
      const updated = await categoryService.updateCategory(tenantId, categoryId, req.body, req.user?.id);
      sendResponse(res, 200, updated);
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const categoryId = req.params.id as string;
      await categoryService.deleteCategory(tenantId, categoryId, req.user?.id);
      sendResponse(res, 200, { message: 'Category removed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const categoryController = new CategoryController();
