import { z } from 'zod';

export const createLicenseSchema = z.object({
  vendorId: z.string().uuid(),
  name: z.string().min(2).max(200),
  licenseKey: z.string().optional(),
  licenseType: z.enum(['per_seat', 'site', 'subscription', 'perpetual', 'open_source']),
  totalSeats: z.number().int().nonnegative().default(1),
  cost: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('USD'),
  startsAt: z.string().datetime().or(z.date()),
  expiresAt: z.string().datetime().or(z.date()).optional().nullable(),
  isAutoRenew: z.boolean().default(false),
  renewalReminderDays: z.number().int().nonnegative().default(30),
  status: z.enum(['active', 'expired', 'suspended', 'pending_renewal']).default('active'),
});

export const updateLicenseSchema = z.object({
  vendorId: z.string().uuid().optional(),
  name: z.string().min(2).max(200).optional(),
  licenseKey: z.string().optional(),
  licenseType: z.enum(['per_seat', 'site', 'subscription', 'perpetual', 'open_source']).optional(),
  totalSeats: z.number().int().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  startsAt: z.string().datetime().or(z.date()).optional(),
  expiresAt: z.string().datetime().or(z.date()).optional().nullable(),
  isAutoRenew: z.boolean().optional(),
  renewalReminderDays: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'expired', 'suspended', 'pending_renewal']).optional(),
});

export type CreateLicenseInput = z.infer<typeof createLicenseSchema>;
export type UpdateLicenseInput = z.infer<typeof updateLicenseSchema>;
