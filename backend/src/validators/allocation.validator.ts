// ==============================================================================
// AssetVault: License Allocation Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const allocateSeatSchema = z
  .object({
    licenseId: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().optional()),
    userId: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().optional()),
    userEmail: z.preprocess(
      (v) => (v === '' || v === null ? undefined : v),
      z.string().email('Valid email address is required').toLowerCase().trim().optional()
    ),
    userFullName: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().optional()),
    fullName: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().optional()),
    notes: z.string().max(500).optional(),
  })
  .strip();

export const releaseSeatSchema = z
  .object({
    allocationId: z.string().min(1).optional(),
    reason: z.string().max(255).optional(),
  })
  .strip();

