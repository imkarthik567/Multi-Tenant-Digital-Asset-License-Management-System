// ==============================================================================
// AssetVault: Notification Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { notificationRepository } from '../repositories/notification.repository';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export class NotificationService {
  public async listUserNotifications(
    prismaClient: any,
    userId: string,
    params: PaginationParams,
    filter: { isRead?: boolean } = {}
  ) {
    const { data, total } = await notificationRepository.findUserNotifications(
      prismaClient,
      userId,
      params,
      filter
    );
    return formatPaginatedResponse(data, total, params);
  }

  public async markAsRead(prismaClient: any, id: string, userId: string) {
    await notificationRepository.markAsRead(prismaClient, id, userId);
    return { success: true, message: 'Notification marked as read' };
  }

  public async markAllAsRead(prismaClient: any, userId: string) {
    await notificationRepository.markAllAsRead(prismaClient, userId);
    return { success: true, message: 'All notifications marked as read' };
  }

  public async triggerExpiryCheck(tenantId: string, userId: string, lookaheadDays: number = 30) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const count = await notificationRepository.runExpiryCheck(tx, tenantId, lookaheadDays);
      return {
        success: true,
        message: `Expiry check completed successfully. Generated ${count} new alerts.`,
        notificationsGenerated: count,
      };
    });
  }
}

export const notificationService = new NotificationService();
