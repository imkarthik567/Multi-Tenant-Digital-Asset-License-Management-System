import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';

const router = Router();

router.get(
  '/',
  authenticate,
  tenantScope,
  notificationController.listNotifications
);

router.patch(
  '/:id/read',
  authenticate,
  tenantScope,
  notificationController.markAsRead
);

router.post(
  '/read-all',
  authenticate,
  tenantScope,
  notificationController.markAllAsRead
);

export const notificationRoutes = router;
