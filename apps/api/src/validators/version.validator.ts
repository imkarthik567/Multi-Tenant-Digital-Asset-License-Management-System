// ==============================================================================
// AssetVault: Asset Version Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createVersionSchema = z
  .object({
    fileUrl: z.string().url('fileUrl must be a valid URL'),
    fileSize: z.number().int().positive('fileSize must be a positive integer in bytes'),
    checksum: z.string().min(8).max(128).trim(),
    changelog: z.string().max(1000).optional().nullable(),
  })
  .strip();

export const compareVersionsQuerySchema = z
  .object({
    from: z.string().transform((v) => parseInt(v, 10)),
    to: z.string().transform((v) => parseInt(v, 10)),
  })
  .strip();
