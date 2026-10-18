// ==============================================================================
// AssetVault: Asset Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// Strips unknown fields to block mass assignment (tenant_id / role_id)
// ==============================================================================

import { z } from 'zod';
import { AssetType, AssetStatus } from '@prisma/client';

export const createAssetSchema = z
  .object({
    name: z.string().min(2).max(200).trim(),
    assetCode: z.string().min(2).max(50).trim(),
    assetType: z.nativeEnum(AssetType),
    description: z.string().max(1000).optional().nullable(),
    categoryId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().optional().nullable()),
    fileUrl: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
    fileSizeBytes: z.number().int().positive().optional(),
    checksumSha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, 'checksumSha256 must be a 64-character hexadecimal SHA-256 checksum').optional(),
    tags: z.array(z.string()).optional(),
  })
  .strip()
  .refine((data) => !data.fileUrl || Boolean(data.checksumSha256), {
    message: 'checksumSha256 is required when fileUrl is provided',
    path: ['checksumSha256'],
  });

export const updateAssetSchema = z
  .object({
    name: z.string().min(2).max(200).trim().optional(),
    assetType: z.nativeEnum(AssetType).optional(),
    description: z.string().max(1000).optional().nullable(),
    categoryId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().optional().nullable()),
    status: z.nativeEnum(AssetStatus).optional(),
  })
  .strip();

export const attachTagsSchema = z
  .object({
    tagIds: z.array(z.string().uuid()).min(1, 'Must provide at least one tag ID'),
  })
  .strip();

export const queryAssetSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    categoryId: z.string().uuid().optional(),
    assetType: z.nativeEnum(AssetType).optional(),
    status: z.nativeEnum(AssetStatus).optional(),
    tag: z.string().optional(),
    ownerId: z.string().uuid().optional(),
    complianceStatus: z.enum(['COMPLIANT', 'EXPIRED_LICENSE', 'UNLICENSED']).optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
  })
  .strip();
