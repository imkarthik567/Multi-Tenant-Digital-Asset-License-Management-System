import { Router } from 'express';
import { tagController } from './tag.controller';
import { createTagSchema, updateTagSchema } from './tag.schema';
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
  tagController.listTags
);

router.post(
  '/',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: createTagSchema }),
  tagController.createTag
);

router.patch(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  validate({ body: updateTagSchema }),
  tagController.updateTag
);

router.delete(
  '/:id',
  authenticate,
  authorize('tenant_admin', 'asset_manager'),
  tenantScope,
  tagController.deleteTag
);

export const tagRoutes = router;
