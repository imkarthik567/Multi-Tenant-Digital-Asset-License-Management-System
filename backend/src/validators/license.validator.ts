// ==============================================================================
// AssetVault: License Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces date bounds: end_date must be greater than or equal to start_date
// ==============================================================================

import { z } from 'zod';
import { LicenseStatus } from '@prisma/client';
import { dateStringSchema } from './date.validator';

const licenseDateSchema = dateStringSchema.transform((value) => new Date(value));

const positiveIntegerQuery = z
  .string()
  .regex(/^[1-9]\d*$/, 'Must be a positive integer')
  .refine((value) => Number(value) <= 2147483647, 'Must fit a PostgreSQL integer');

const nonNegativeIntegerQuery = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, 'Must be a non-negative integer')
  .refine((value) => Number(value) <= 2147483647, 'Must fit a PostgreSQL integer');

const nonNegativeCostQuery = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Must be a non-negative amount with at most two decimal places')
  .refine((value) => Number(value) <= 9999999999.99, 'Must fit the license cost range');

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
    licenseTypeId: positiveIntegerQuery.optional(),
    expiringWithinDays: nonNegativeIntegerQuery.optional(),
    minCost: nonNegativeCostQuery.optional(),
    maxCost: nonNegativeCostQuery.optional(),
    fullyAllocated: z.enum(['true', 'false']).optional(),
  })
  .strip()
  .refine(
    (data) => data.minCost === undefined || data.maxCost === undefined || Number(data.minCost) <= Number(data.maxCost),
    { message: 'minCost must be less than or equal to maxCost', path: ['maxCost'] }
  );
