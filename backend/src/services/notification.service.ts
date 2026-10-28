// ==============================================================================
// AssetVault: Notification Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { notificationRepository } from '../repositories/notification.repository';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { notificationStreamService } from './notificationStream.service';
import { emailService } from './email.service';
import { mockStore } from '../config/mockStore';

export class NotificationService {
  public async listUserNotifications(
    prismaClient: any,
    userId: string,
    params: PaginationParams,
    filter: { isRead?: boolean; type?: any; dateFrom?: Date; dateTo?: Date } = {}
  ) {
    const { data, total } = await notificationRepository.findUserNotifications(
      prismaClient,
      userId,
      params,
      filter
    );
    return formatPaginatedResponse(data, total, params);
  }

  public async listEmailDeliveries(
    tenantId: string | null,
    userId: string,
    userEmail: string,
    userRole: string
  ) {
    const allLogs = Array.isArray(mockStore.state.emailDeliveries)
      ? mockStore.state.emailDeliveries
      : [];

    const filtered = allLogs.filter((entry) => {
      if (userRole === 'SUPER_ADMIN') {
        return tenantId ? entry.tenantId === tenantId : true;
      }
      if (entry.tenantId !== tenantId) return false;
      if (userRole === 'MEMBER') {
        return (
          entry.recipientUserId === userId ||
          entry.recipientEmail?.toLowerCase() === userEmail?.toLowerCase()
        );
      }
      return true;
    });

    return filtered;
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
    const result = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const count = await notificationRepository.runExpiryCheck(tx, tenantId, lookaheadDays);
      return {
        notificationsGenerated: count,
      };
    });

    const emailDispatch = await emailService.dispatchPendingExpiryEmailsForTenant(
      tenantId,
      lookaheadDays
    );

    if (result.notificationsGenerated > 0 || emailDispatch.emailsSent > 0) {
      notificationStreamService.broadcastNotification({
        tenantId,
        notification: {
          type: 'EXPIRY_CHECK_COMPLETED',
          message: `Dispatched ${emailDispatch.emailsSent} automated expiry emails to organization members (${emailDispatch.recipients.join(', ')})`,
          count: result.notificationsGenerated,
          emailsSent: emailDispatch.emailsSent,
          recipients: emailDispatch.recipients,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return {
      success: true,
      message: `Expiry check completed: ${result.notificationsGenerated} alerts generated and ${emailDispatch.emailsSent} automated emails dispatched to organization members.`,
      notificationsGenerated: result.notificationsGenerated,
      emailsSent: emailDispatch.emailsSent,
      recipients: emailDispatch.recipients,
    };
  }
}

export const notificationService = new NotificationService();

