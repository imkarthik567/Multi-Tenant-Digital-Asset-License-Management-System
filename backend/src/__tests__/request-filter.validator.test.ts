import { describe, expect, it } from 'vitest';
import { queryAccessLogSchema } from '../validators/access.validator';
import { queryAssetSchema } from '../validators/asset.validator';
import {
  exportAuditLogQuerySchema,
  queryAuditLogSchema,
} from '../validators/audit.validator';

describe('request date and cursor filters', () => {
  it('rejects malformed dates before they reach database queries', () => {
    expect(queryAssetSchema.safeParse({ createdFrom: 'not-a-date' }).success).toBe(false);
    expect(queryAccessLogSchema.safeParse({ dateFrom: 'not-a-date' }).success).toBe(false);
    expect(queryAuditLogSchema.safeParse({ dateTo: 'not-a-date' }).success).toBe(false);
    expect(exportAuditLogQuerySchema.safeParse({ startDate: 'not-a-date' }).success).toBe(false);
  });

  it('accepts date-only filters and preserves supported audit cursors', () => {
    const asset = queryAssetSchema.safeParse({ createdFrom: '2026-10-01' });
    const access = queryAccessLogSchema.safeParse({ dateTo: '2026-10-18', cursor: '123' });
    const audit = queryAuditLogSchema.safeParse({ cursor: '456' });

    expect(asset.success).toBe(true);
    expect(access.success && access.data.cursor).toBe('123');
    expect(audit.success && audit.data.cursor).toBe('456');
  });

  it('rejects malformed cursor values', () => {
    expect(queryAccessLogSchema.safeParse({ cursor: 'abc' }).success).toBe(false);
    expect(queryAuditLogSchema.safeParse({ cursor: '-1' }).success).toBe(false);
  });
});
