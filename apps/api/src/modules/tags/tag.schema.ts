import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid 6-character hex color (e.g. #3B82F6)').default('#6B7280'),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid 6-character hex color').optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
