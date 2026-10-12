import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';
import { sendResponse } from '../../utils/response.util';

export class NotificationController {
  async listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const notifications = await notificationService.listUserNotifications(userId);
      sendResponse(res, 200, notifications);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.id as string;
      const updated = await notificationService.markAsRead(userId, notificationId);
      sendResponse(res, 200, updated);
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await notificationService.markAllAsRead(userId);
      sendResponse(res, 200, { message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
