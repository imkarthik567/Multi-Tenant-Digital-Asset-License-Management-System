// ==============================================================================
// AssetVault: User Routes with Authorization Check
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';

const router = Router();

// GET /api/users - List organization users (Requires users:read, forbidden for MEMBER)
router.get(
  '/',
  authenticate,
  loadUser,
  authorize('users:read'),
  tenantContext,
  userController.listUsers
);

export default router;
