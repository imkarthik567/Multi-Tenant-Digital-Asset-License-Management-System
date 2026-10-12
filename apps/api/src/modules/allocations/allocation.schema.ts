import { z } from 'zod';

export const allocateSeatSchema = z.object({
  licenseId: z.string().uuid(),
  userId: z.string().uuid(),
  notes: z.string().optional(),
});

export const revokeSeatSchema = z.object({
  reason: z.string().optional(),
});

export type AllocateSeatInput = z.infer<typeof allocateSeatSchema>;
export type RevokeSeatInput = z.infer<typeof revokeSeatSchema>;
