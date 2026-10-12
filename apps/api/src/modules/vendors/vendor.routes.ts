import { Router } from 'express';
import { vendorController } from './vendor.controller';
import { createVendorSchema, updateVendorSchema } from './vendor.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  vendorController.listVendors
);

router.get(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  vendorController.getVendorById
);

router.post(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: createVendorSchema }),
  vendorController.createVendor
);

router.patch(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: updateVendorSchema }),
  vendorController.updateVendor
);

router.delete(
  '/:id',
  authenticate,
  authorize('tenant_admin'),
  tenantScope,
  vendorController.deleteVendor
);

export const vendorRoutes = router;
