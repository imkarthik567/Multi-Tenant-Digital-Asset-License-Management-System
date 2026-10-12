import { Router } from 'express';
import { assetController } from './asset.controller';
import { createAssetSchema, updateAssetSchema, logAccessSchema } from './asset.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// List assets with pagination, search, filter
router.get(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  assetController.listAssets
);

// Get single asset by ID
router.get(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  assetController.getAssetById
);

// Create asset
router.post(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: createAssetSchema }),
  assetController.createAsset
);

// Update asset
router.patch(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: updateAssetSchema }),
  assetController.updateAsset
);

// Soft delete asset
router.delete(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  assetController.deleteAsset
);

// Record asset access / download log
router.post(
  '/:id/access',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  validate({ body: logAccessSchema }),
  assetController.logAccess
);

export const assetRoutes = router;
