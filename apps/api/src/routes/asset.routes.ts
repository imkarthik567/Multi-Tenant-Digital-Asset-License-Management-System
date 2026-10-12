// ==============================================================================
// AssetVault: Asset Routes with Standard Middleware Chain
// Course: BCSE307L Database Systems (Fall 2026-27)
// Pipeline: authenticate -> loadUser -> authorize -> tenantContext -> validate -> controller
// ==============================================================================

import { Router } from 'express';
import { assetController } from '../controllers/asset.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAssetSchema, searchAssetSchema } from '../validators/asset.validator';

const router = Router();

// GET /api/assets - List assets (Requires assets:read)
router.get(
  '/',
  authenticate,
  loadUser,
  authorize('assets:read'),
  tenantContext,
  validate({ query: searchAssetSchema }),
  assetController.listAssets
);

// GET /api/assets/:id - Get asset by ID (Requires assets:read; Cross-tenant returns 404)
router.get(
  '/:id',
  authenticate,
  loadUser,
  authorize('assets:read'),
  tenantContext,
  assetController.getAssetById
);

// POST /api/assets - Create asset (Requires assets:create; Zod strips mass-assignment fields)
router.post(
  '/',
  authenticate,
  loadUser,
  authorize('assets:create'),
  tenantContext,
  validate(createAssetSchema),
  assetController.createAsset
);

export default router;
