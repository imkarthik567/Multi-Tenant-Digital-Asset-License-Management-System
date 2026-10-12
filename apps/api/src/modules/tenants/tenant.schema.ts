import { z } from 'zod';

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  subscriptionTier: z.enum(['free', 'standard', 'enterprise']).optional(),
  status: z.enum(['active', 'suspended', 'trial']).optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
