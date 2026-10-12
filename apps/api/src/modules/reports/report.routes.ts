import { Router } from 'express';
import { reportController } from './report.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';

const router = Router();

router.get(
  '/overview',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  reportController.getDashboardOverview
);

router.get(
  '/license-utilization',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'auditor'),
  tenantScope,
  reportController.getLicenseUtilization
);

router.get(
  '/expiring-licenses',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'auditor'),
  tenantScope,
  reportController.getExpiringLicenses
);

router.get(
  '/storage-stats',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'auditor'),
  tenantScope,
  reportController.getStorageStats
);

export const reportRoutes = router;
