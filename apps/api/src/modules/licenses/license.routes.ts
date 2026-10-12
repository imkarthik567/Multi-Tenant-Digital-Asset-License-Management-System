import { Router } from 'express';
import { licenseController } from './license.controller';
import { createLicenseSchema, updateLicenseSchema } from './license.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// List licenses
router.get(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  licenseController.listLicenses
);

// Get single license by ID
router.get(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  licenseController.getLicenseById
);

// Create license
router.post(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: createLicenseSchema }),
  licenseController.createLicense
);

// Update license
router.patch(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: updateLicenseSchema }),
  licenseController.updateLicense
);

// Soft delete license
router.delete(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  licenseController.deleteLicense
);

export const licenseRoutes = router;
