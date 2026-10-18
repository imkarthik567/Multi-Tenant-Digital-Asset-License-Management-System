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
      const rawDays = val.lookaheadDays !== undefined ? val.lookaheadDays : val.daysAhead;
      const lookaheadDays =
        rawDays !== undefined
          ? typeof rawDays === 'string' && /^[1-9]\d*$/.test(rawDays)
            ? Number(rawDays)
            : rawDays
          : 30;
      return {
        ...val,
        lookaheadDays,
      };
    }
    return { lookaheadDays: 30 };
  },
  z
    .object({
      lookaheadDays: z.number().int().min(1).max(365).default(30),
    })
    .passthrough()
);
