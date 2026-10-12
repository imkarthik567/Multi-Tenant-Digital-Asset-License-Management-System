// ==============================================================================
// AssetVault: Primary API Router
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { healthRoutes } from './health.routes';
import authRoutes from './auth.routes';
import assetRoutes from './asset.routes';
import userRoutes from './user.routes';
import tenantRoutes from './tenant.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/assets', assetRoutes);
router.use('/users', userRoutes);
router.use('/tenants', tenantRoutes);

export default router;
