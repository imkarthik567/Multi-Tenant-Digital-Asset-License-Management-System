// ==============================================================================
// AssetVault: Audit Log Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';
import { AuditAction } from '@prisma/client';

const queryDateSchema = z.string().refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  'Must be a valid date'
);

export const queryAuditLogSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    cursor: z.string().regex(/^\\d+$/, 'cursor must be a positive integer').optional(),
    tableName: z.string().optional(),
    action: z.nativeEnum(AuditAction).optional(),
    userId: z.string().uuid().optional(),
    dateFrom: queryDateSchema.optional(),
    dateTo: queryDateSchema.optional(),
  })
  .strip();

export const exportAuditLogQuerySchema = z
  .object({
    action: z.string().optional(),
    tableName: z.string().optional(),
    userId: z.string().uuid().optional(),
    dateFrom: queryDateSchema.optional(),
    dateTo: queryDateSchema.optional(),
    startDate: queryDateSchema.optional(),
    endDate: queryDateSchema.optional(),
  })
  .strip();
