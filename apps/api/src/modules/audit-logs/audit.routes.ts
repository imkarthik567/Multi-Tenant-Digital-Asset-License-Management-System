import { Router } from 'express';
import { auditController } from './audit.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('tenant_admin', 'auditor'),
  tenantScope,
  auditController.listLogs
);

export const auditRoutes = router;
