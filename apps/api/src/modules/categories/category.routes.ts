import { Router } from 'express';
import { categoryController } from './category.controller';
import { createCategorySchema, updateCategorySchema } from './category.schema';
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
  categoryController.listCategories
);

router.post(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: createCategorySchema }),
  categoryController.createCategory
);

router.patch(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: updateCategorySchema }),
  categoryController.updateCategory
);

router.delete(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  categoryController.deleteCategory
);

export const categoryRoutes = router;
