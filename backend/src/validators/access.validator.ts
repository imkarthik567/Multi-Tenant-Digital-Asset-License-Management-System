// ==============================================================================
// AssetVault: Access Log Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';
import { AccessAction } from '@prisma/client';

const queryDateSchema = z.string().refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  'Must be a valid date'
);

export const queryAccessLogSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    action: z.nativeEnum(AccessAction).optional(),
    userId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    cursor: z.string().regex(/^\\d+$/, 'cursor must be a positive integer').optional(),
    dateFrom: queryDateSchema.optional(),
    dateTo: queryDateSchema.optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();
