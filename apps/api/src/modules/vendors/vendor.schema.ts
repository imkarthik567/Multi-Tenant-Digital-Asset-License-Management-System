import { z } from 'zod';

export const createVendorSchema = z.object({
  name: z.string().min(2).max(150),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  websiteUrl: z.string().url().optional().or(z.string()),
  address: z.string().optional(),
});

export const updateVendorSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  websiteUrl: z.string().url().optional().or(z.string()),
  address: z.string().optional(),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
