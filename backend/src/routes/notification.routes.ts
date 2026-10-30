// ==============================================================================
// AssetVault: Notification Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { queryNotificationSchema, runExpiryCheckSchema } from '../validators/notification.validator';

import { notificationStreamService } from '../services/notificationStream.service';

const router = Router();

// Public/Authenticated Test Endpoint to verify role change (ASSET_MANAGER -> MEMBER) queues and sends email
router.post('/test-role-change', notificationController.triggerTestRoleChangeNotification);
router.get('/test-role-change', notificationController.triggerTestRoleChangeNotification);

router.use(authenticate, loadUser, tenantContext);

// Real-time Server-Sent Events stream for instant notification updates
router.get('/stream', authorize('notifications:read'), (req, res) => {
  notificationStreamService.addClient(req.user!.id, req.user!.tenantId || null, res, req.user!.role);
});

// Read-all patch route (must precede /:id/read)
router.patch('/read-all', authorize('notifications:read'), notificationController.markAllAsRead);

// Automated organization email delivery log & real Gmail API / SMTP status/flush
router.get('/email-logs', authorize('notifications:read'), notificationController.listEmailLogs);
router.post('/email-logs/:id/send-gmail', authorize('notifications:read'), notificationController.sendLoggedEmailViaGmail);
router.get('/gmail-status', authorize('notifications:read'), notificationController.getGmailStatus);
router.post('/gmail-connect', authorize('notifications:read'), notificationController.connectGmailAndFlush);
router.post('/gmail-smtp', authorize('notifications:read'), notificationController.configureGmailSmtpAndFlush);
router.post('/gmail-disconnect', authorize('notifications:read'), notificationController.disconnectGmail);

// List notifications
router.get('/', authorize('notifications:read'), validate({ query: queryNotificationSchema }), notificationController.listNotifications);

// Mark specific notification as read
router.patch('/:id/read', authorize('notifications:read'), notificationController.markAsRead);

// Run automated license expiry check (Generates notifications via fn_generate_expiry_notifications & dispatches automated emails)
router.post('/run-expiry-check', authorize('notifications:manage'), validate(runExpiryCheckSchema), notificationController.runExpiryCheck);

export default router;

