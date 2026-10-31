// ==============================================================================
// AssetVault: Asset Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// Strips unknown fields to block mass assignment (tenant_id / role_id)
// ==============================================================================

import { z } from 'zod';
import { AssetType, AssetStatus } from '@prisma/client';

const AssetTypeEnum = (AssetType || {
  FONT: 'FONT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  SOFTWARE: 'SOFTWARE',
  DATASET: 'DATASET',
  DOCUMENT: 'DOCUMENT',
  OTHER: 'OTHER',
}) as typeof AssetType;

const AssetStatusEnum = (AssetStatus || {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
}) as typeof AssetStatus;

export const createAssetSchema = z
  .object({
    name: z.string().min(2).max(200).trim(),
    assetCode: z.string().min(2).max(50).trim(),
    assetType: z.nativeEnum(AssetTypeEnum),
    description: z.string().max(1000).optional().nullable(),
    categoryId: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).optional().nullable()),
    fileUrl: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
    fileSizeBytes: z.number().int().positive().optional(),
    checksumSha256: z.string().length(64).optional(),
    tags: z.array(z.string()).optional(),
  })
  .strip();

export const updateAssetSchema = z
  .object({
    name: z.string().min(2).max(200).trim().optional(),
    assetType: z.nativeEnum(AssetTypeEnum).optional(),
    description: z.string().max(1000).optional().nullable(),
    categoryId: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).optional().nullable()),
    status: z.nativeEnum(AssetStatusEnum).optional(),
  })
  .strip();

export const attachTagsSchema = z
  .object({
    tagIds: z.array(z.string().min(1)).optional(),
    tagNames: z.array(z.string().min(1)).optional(),
    tag: z.string().min(1).optional(),
  })
  .strip();

export const queryAssetSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    categoryId: z.string().min(1).optional(),
    assetType: z.nativeEnum(AssetTypeEnum).optional(),
    status: z.nativeEnum(AssetStatusEnum).optional(),
    tag: z.string().optional(),
    ownerId: z.string().min(1).optional(),
    complianceStatus: z.enum(['COMPLIANT', 'EXPIRED_LICENSE', 'UNLICENSED']).optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
  })
  .strip();
