// ==============================================================================
// AssetVault: Notification Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const queryNotificationSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    isRead: z.enum(['true', 'false']).optional(),
  })
  .strip();

export const runExpiryCheckSchema = z
  .object({
    lookaheadDays: z.number().int().min(1).max(365).optional().default(30),
  })
  .strip();
