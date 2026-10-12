import { Router } from 'express';
import { allocationController } from './allocation.controller';
import { allocateSeatSchema, revokeSeatSchema } from './allocation.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// List allocations
router.get(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  allocationController.listAllocations
);

// Allocate seat to user
router.post(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: allocateSeatSchema }),
  allocationController.allocateSeat
);

// Revoke seat from user
router.post(
  '/:id/revoke',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: revokeSeatSchema }),
  allocationController.revokeSeat
);

export const allocationRoutes = router;
