// ==============================================================================
// AssetVault: Access Log Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';
import { AccessAction } from '@prisma/client';

export const queryAccessLogSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    action: z.nativeEnum(AccessAction).optional(),
    userId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();
