// ==============================================================================
// AssetVault: License Allocation Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const allocateSeatSchema = z
  .object({
    licenseId: z.string().trim().optional(),
    userId: z.string().trim().optional(),
    userEmail: z.string().email('Valid email address is required').toLowerCase().trim().optional(),
    userFullName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.userId || data.userEmail), {
    message: 'Either userId or userEmail is required to allocate a license seat',
  });

export const releaseSeatSchema = z
  .object({
    allocationId: z.string().min(1).optional(),
    reason: z.string().max(255).optional(),
  })
  .strip();

