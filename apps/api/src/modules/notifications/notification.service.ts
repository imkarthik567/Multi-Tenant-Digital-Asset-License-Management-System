import { prisma } from '../../config/database';
import { NotFoundError } from '../../errors/AppError';

export class NotificationService {
  async listUserNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const existing = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) throw new NotFoundError('Notification not found');

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

export const notificationService = new NotificationService();
