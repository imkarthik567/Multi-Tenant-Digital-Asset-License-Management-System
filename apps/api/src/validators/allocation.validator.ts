// ==============================================================================
// AssetVault: License Allocation Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const allocateSeatSchema = z
  .object({
    userId: z.string().uuid('userId must be a valid UUID'),
  })
  .strip();

export const releaseSeatSchema = z
  .object({
    allocationId: z.string().uuid().optional(),
    reason: z.string().max(255).optional(),
  })
  .strip();
