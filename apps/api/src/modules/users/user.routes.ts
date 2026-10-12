import { Router } from 'express';
import { userController } from './user.controller';
import { createUserSchema, updateUserSchema } from './user.schema';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { tenantScope } from '../../middleware/tenantScope.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// List tenant users
router.get(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager', 'member', 'auditor'),
  tenantScope,
  userController.listUsers
);

// Create / Invite user (Admin only)
router.post(
  '/',
  authenticate,
  authorize('tenant_admin'),
  tenantScope,
  validate({ body: createUserSchema }),
  userController.createUser
);

// Update user details or role (Admin only)
router.patch(
  '/:id',
  authenticate,
  authorize('tenant_admin'),
  tenantScope,
  validate({ body: updateUserSchema }),
  userController.updateUser
);

export const userRoutes = router;
