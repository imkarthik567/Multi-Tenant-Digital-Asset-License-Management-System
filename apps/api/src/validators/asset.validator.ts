// ==============================================================================
// AssetVault: Asset Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// Strips unknown fields to block mass assignment (tenant_id / role_id)
// ==============================================================================

import { z } from 'zod';
import { AssetType } from '@prisma/client';

export const createAssetSchema = z
  .object({
    name: z.string().min(2).max(200).trim(),
    assetCode: z.string().min(2).max(50).trim(),
    assetType: z.nativeEnum(AssetType),
    description: z.string().max(1000).optional(),
    categoryId: z.string().uuid().optional(),
  })
  .strip();

export const searchAssetSchema = z
  .object({
    query: z.string().optional(),
    type: z.nativeEnum(AssetType).optional(),
  })
  .strip();

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
