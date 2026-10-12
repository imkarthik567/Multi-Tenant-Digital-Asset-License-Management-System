// ==============================================================================
// AssetVault: Tenant Platform Routes (SUPER_ADMIN Only)
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { tenantController } from '../controllers/tenant.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';

const router = Router();

// GET /api/tenants - List all tenants (Requires tenants:read_platform, SUPER_ADMIN only)
router.get(
  '/',
  authenticate,
  loadUser,
  authorize('tenants:read_platform'),
  tenantContext,
  tenantController.listTenants
);

export default router;
