import { Router } from 'express';
import { tenantController } from './tenant.controller';
import { updateTenantSchema } from './tenant.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// Current tenant details
router.get(
  '/current',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  tenantController.getTenant
);

// Update tenant settings (Admin only)
router.patch(
  '/current',
  authenticate,
  authorize('tenant_admin'),
  tenantScope,
  validate({ body: updateTenantSchema }),
  tenantController.updateTenant
);

// Platform super-admin all tenants listing
router.get(
  '/',
  authenticate,
  authorize('super_admin'),
  tenantController.listAll
);

export const tenantRoutes = router;
