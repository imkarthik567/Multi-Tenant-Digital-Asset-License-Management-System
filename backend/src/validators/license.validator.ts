// ==============================================================================
// AssetVault: License Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces date bounds: end_date must be greater than or equal to start_date
// ==============================================================================

import { z } from 'zod';
import { LicenseStatus } from '@prisma/client';

const licenseDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date')
  .transform((value) => new Date(value));

export const createLicenseSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    vendorId: z.string().uuid(),
    licenseTypeId: z.number().int().positive(),
    licenseKey: z.string().min(4).max(255).trim(),
    totalSeats: z.number().int().positive('totalSeats must be at least 1'),
    cost: z.number().min(0).default(0),
    currency: z.string().length(3).default('USD'),
    startDate: licenseDateSchema,
    endDate: licenseDateSchema.optional().nullable(),
    autoRenew: z.boolean().default(false),
  })
  .strip()
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return data.endDate > data.startDate;
      }
      return true;
    },
    { message: 'End date must be after start date', path: ['endDate'] }
  );

export const updateLicenseSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    vendorId: z.string().uuid().optional(),
    licenseTypeId: z.number().int().positive().optional(),
    licenseKey: z.string().min(4).max(255).trim().optional(),
    totalSeats: z.number().int().positive().optional(),
    cost: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    startDate: licenseDateSchema.optional(),
    endDate: licenseDateSchema.optional().nullable(),
    status: z.nativeEnum(LicenseStatus).optional(),
    autoRenew: z.boolean().optional(),
  })
  .strip()
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate > data.startDate,
    { message: 'End date must be after start date', path: ['endDate'] }
  );

export const renewLicenseSchema = z
  .object({
    newEndDate: licenseDateSchema,
    cost: z.number().min(0, 'Renewal cost must be non-negative'),
    notes: z.string().max(1000).optional(),
  })
  .strip();

export const queryLicenseSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    status: z.nativeEnum(LicenseStatus).optional(),
    vendorId: z.string().uuid().optional(),
    licenseTypeId: z.string().optional(),
    expiringWithinDays: z.string().optional(),
    minCost: z.string().optional(),
    maxCost: z.string().optional(),
    fullyAllocated: z.enum(['true', 'false']).optional(),
  })
  .strip();
