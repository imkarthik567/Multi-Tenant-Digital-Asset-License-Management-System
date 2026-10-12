import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  roleName: z.enum(['tenant_admin', 'asset_manager', 'member', 'auditor']),
  password: z
    .string()
    .min(8)
    .optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  roleName: z.enum(['tenant_admin', 'asset_manager', 'member', 'auditor']).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
