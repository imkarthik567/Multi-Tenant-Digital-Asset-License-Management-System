// ==============================================================================
// AssetVault: Global Search Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate, loadUser, tenantContext);

// GET /api/search?q=
router.get('/', searchController.search);

export default router;
