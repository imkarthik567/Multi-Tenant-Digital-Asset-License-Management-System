// ==============================================================================
// AssetVault: Notification HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { NotificationType } from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { notificationStreamService } from '../services/notificationStream.service';
import { emailService } from '../services/email.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class NotificationController {
  public listNotifications = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'createdAt', ['createdAt', 'isRead', 'type', 'id']);
    const filter = {
      isRead: req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined,
      type: req.query.type as NotificationType | undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    const result = await notificationService.listUserNotifications(
      req.prisma,
      req.user!.id,
      params,
      filter
    );

    sendResponse(res, 200, result.data, result.meta);
  });

  public markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationService.markAsRead(req.prisma, req.params.id as string, req.user!.id);
    sendResponse(res, 200, result);
  });

  public markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationService.markAllAsRead(req.prisma, req.user!.id);
    sendResponse(res, 200, result);
  });

  public runExpiryCheck = asyncHandler(async (req: Request, res: Response) => {
    const lookaheadDays = req.body.lookaheadDays ? parseInt(req.body.lookaheadDays, 10) : 30;
    const result = await notificationService.triggerExpiryCheck(
      req.user!.tenantId!,
      req.user!.id,
      lookaheadDays
    );
    sendResponse(res, 200, result);
  });

  public listEmailLogs = asyncHandler(async (req: Request, res: Response) => {
    const logs = await notificationService.listEmailDeliveries(
      req.user!.tenantId || null,
      req.user!.id,
      req.user!.email,
      req.user!.role
    );
    sendResponse(res, 200, logs);
  });

  public getGmailStatus = asyncHandler(async (req: Request, res: Response) => {
    const status = emailService.getGmailStatus(req.user!.tenantId || null);
    sendResponse(res, 200, status);
  });

  public connectGmailAndFlush = asyncHandler(async (req: Request, res: Response) => {
    const headerToken = req.headers['x-gmail-access-token'];
    const accessToken =
      (typeof req.body?.accessToken === 'string' && req.body.accessToken.trim()) ||
      (typeof headerToken === 'string' && headerToken.trim()) ||
      null;
    const senderEmail =
      typeof req.body?.senderEmail === 'string' ? req.body.senderEmail.trim() : null;
    const flushPending = req.body?.flushPending !== false;

    if (accessToken) {
      emailService.setGmailAccessToken(accessToken, senderEmail);
    }

    let flushedCount = 0;
    let recipients: string[] = [];
    if (flushPending) {
      const flushResult = await emailService.flushPendingEmailsViaGmail(
        req.user!.tenantId || null,
        accessToken || undefined
      );
      flushedCount = flushResult.flushedCount;
      recipients = flushResult.recipients;
    }

    const status = emailService.getGmailStatus(req.user!.tenantId || null);
    sendResponse(res, 200, {
      ...status,
      flushedCount,
      recipients,
    });
  });

  public configureGmailSmtpAndFlush = asyncHandler(async (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const appPassword =
      typeof req.body?.appPassword === 'string' ? req.body.appPassword.trim() : '';

    await emailService.configureGmailSmtp({ email, appPassword });

    const flushResult = await emailService.flushPendingEmailsViaGmail(
      req.user!.tenantId || null
    );
    const status = emailService.getGmailStatus(req.user!.tenantId || null);

    sendResponse(res, 200, {
      ...status,
      flushedCount: flushResult.flushedCount,
      recipients: flushResult.recipients,
    });
  });

  public disconnectGmail = asyncHandler(async (req: Request, res: Response) => {
    emailService.disconnectAllGmailSenders();
    const status = emailService.getGmailStatus(req.user!.tenantId || null);
    sendResponse(res, 200, status);
  });

  public sendLoggedEmailViaGmail = asyncHandler(async (req: Request, res: Response) => {
    const headerToken = req.headers['x-gmail-access-token'];
    const accessToken =
      (typeof req.body?.accessToken === 'string' && req.body.accessToken.trim()) ||
      (typeof headerToken === 'string' && headerToken.trim()) ||
      undefined;

    const updated = await emailService.sendLoggedEmailViaGmail(
      req.params.id as string,
      accessToken
    );

    sendResponse(res, 200, updated);
  });

  public triggerTestRoleChangeNotification = asyncHandler(async (req: Request, res: Response) => {
    const rawEmail =
      (typeof req.body?.email === 'string' && req.body.email.trim()) ||
      (typeof req.query?.email === 'string' && req.query.email.trim()) ||
      req.user?.email ||
      'karthiksmrk7377@gmail.com';

    const targetEmail = rawEmail.toLowerCase();
    const localPart = targetEmail.split('@')[0] || 'member';
    const derivedName =
      localPart
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
        .trim() || 'Organization Member';

    const fullName =
      (typeof req.body?.fullName === 'string' && req.body.fullName.trim()) ||
      (typeof req.query?.fullName === 'string' && req.query.fullName.trim()) ||
      derivedName;

    const previousRole =
      (typeof req.body?.previousRole === 'string' && req.body.previousRole.trim()) ||
      (typeof req.query?.previousRole === 'string' && req.query.previousRole.trim()) ||
      'ASSET_MANAGER';

    const newRole =
      (typeof req.body?.newRole === 'string' && req.body.newRole.trim()) ||
      (typeof req.query?.newRole === 'string' && req.query.newRole.trim()) ||
      'MEMBER';

    const reason =
      (typeof req.body?.reason === 'string' && req.body.reason.trim()) ||
      (typeof req.query?.reason === 'string' && req.query.reason.trim()) ||
      'Administrative role realignment (Test Verification: ASSET_MANAGER → MEMBER)';

    const headerToken = req.headers['x-gmail-access-token'];
    const accessToken =
      (typeof req.body?.accessToken === 'string' && req.body.accessToken.trim()) ||
      (typeof headerToken === 'string' && headerToken.trim()) ||
      null;

    if (accessToken) {
      emailService.setGmailAccessToken(accessToken);
    }

    const tenantId = req.user?.tenantId || 'tenant-acme-corp';
    const userId = req.user?.id || 'user-acme-manager';

    const result: any = await emailService.dispatchRoleChangeEmail({
      tenantId,
      userId,
      email: targetEmail,
      fullName,
      previousRole,
      newRole,
      reason,
    });

    sendResponse(res, 200, {
      verified: true,
      message: `Triggered role-change notification (${previousRole} → ${newRole}) and dispatched email to ${targetEmail}`,
      recipientEmail: targetEmail,
      previousRole,
      newRole,
      deliveryChannel: result?.emailRecord?.deliveryChannel || 'GMAIL',
      realGmailSent: Boolean(result?.emailRecord?.realGmailSent),
      emailRecord: result?.emailRecord || null,
      notification: result?.notification || null,
    });
  });

  public streamNotifications = (req: Request, res: Response): void => {
    notificationStreamService.addClient(
      req.user!.id,
      req.user!.tenantId || null,
      res,
      req.user!.role
    );
  };
}

export const notificationController = new NotificationController();

