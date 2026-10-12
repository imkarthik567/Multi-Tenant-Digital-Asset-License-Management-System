import { z } from 'zod';

export const createAssetSchema = z.object({
  name: z.string().min(2).max(200),
  categoryId: z.string().uuid(),
  assetType: z.enum(['font', 'image', 'software', 'dataset', 'video', 'document', 'other']),
  description: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.string()),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(100).optional(),
  version: z.string().max(50).default('1.0.0'),
  metadata: z.record(z.unknown()).default({}),
  tagIds: z.array(z.string().uuid()).optional(),
  licenseIds: z.array(z.string().uuid()).optional(),
});

export const updateAssetSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  assetType: z.enum(['font', 'image', 'software', 'dataset', 'video', 'document', 'other']).optional(),
  description: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.string()),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(100).optional(),
  version: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  licenseIds: z.array(z.string().uuid()).optional(),
});

export const logAccessSchema = z.object({
  action: z.enum(['view', 'download', 'checkout', 'checkin']),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type LogAccessInput = z.infer<typeof logAccessSchema>;
