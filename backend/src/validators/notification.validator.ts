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

export const runExpiryCheckSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const days = val.lookaheadDays !== undefined ? val.lookaheadDays : val.daysAhead;
      return {
        ...val,
        lookaheadDays: days !== undefined ? days : 30,
      };
    }
    return val !== undefined ? val : { lookaheadDays: 30 };
  },
  z
    .object({
      lookaheadDays: z.coerce.number().int().min(1).max(365).default(30),
    })
    .strip()
);
