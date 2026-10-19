// ==============================================================================
// AssetVault: Tenant Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { uuidIdParamsSchema } from '../validators/id.validator';
import { Router } from 'express';
import { tenantController } from '../controllers/tenant.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createTenantSchema,
  updateTenantSchema,
  updateTenantStatusSchema,
  updateTenantPlanSchema,
  queryTenantSchema,
} from '../validators/tenant.validator';

const router = Router();

router.use(authenticate, loadUser);

// Platform-level tenant listing (Super Admin)
router.get('/', authorize('tenants:read_platform'), tenantContext, validate({ query: queryTenantSchema }), tenantController.listTenants);

// 1. Export entire tenant archive as JSON (Tenant Admin)
router.get('/export', authorize('tenants:update_own'), tenantContext, tenantController.exportTenantData);

// 2. Get tenant details (Super Admin or own tenant)
router.get('/:id', authorize('tenants:read_own'), tenantContext, validate({ params: uuidIdParamsSchema }), tenantController.getTenantById);

// Platform tenant management (Super Admin)
router.post('/', authorize('tenants:manage_platform'), tenantContext, validate(createTenantSchema), tenantController.createTenant);
router.patch('/:id', authorize('tenants:manage_platform'), tenantContext, validate({ params: uuidIdParamsSchema }), validate(updateTenantSchema), tenantController.updateTenant);
router.patch('/:id/status', authorize('tenants:manage_platform'), tenantContext, validate({ params: uuidIdParamsSchema }), validate(updateTenantStatusSchema), tenantController.updateStatus);
router.patch('/:id/plan', authorize('tenants:manage_platform'), tenantContext, validate({ params: uuidIdParamsSchema }), validate(updateTenantPlanSchema), tenantController.changePlan);
router.delete('/:id', authorize('tenants:manage_platform'), tenantContext, validate({ params: uuidIdParamsSchema }), tenantController.deleteTenant);

export default router;
