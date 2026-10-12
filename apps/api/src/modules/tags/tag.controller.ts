import { Request, Response, NextFunction } from 'express';
import { tagService } from './tag.service';
import { sendResponse } from '../../utils/response.util';

export class TagController {
  async listTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const tags = await tagService.listTags(tenantId);
      sendResponse(res, 200, tags);
    } catch (error) {
      next(error);
    }
  }

  async createTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const tag = await tagService.createTag(tenantId, req.body, req.user?.id);
      sendResponse(res, 201, tag);
    } catch (error) {
      next(error);
    }
  }

  async updateTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const tagId = req.params.id as string;
      const updated = await tagService.updateTag(tenantId, tagId, req.body, req.user?.id);
      sendResponse(res, 200, updated);
    } catch (error) {
      next(error);
    }
  }

  async deleteTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenant!.id;
      const tagId = req.params.id as string;
      await tagService.deleteTag(tenantId, tagId, req.user?.id);
      sendResponse(res, 200, { message: 'Tag removed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const tagController = new TagController();
