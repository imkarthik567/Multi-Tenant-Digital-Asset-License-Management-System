import { describe, expect, it } from 'vitest';
import { queryAccessLogSchema } from '../validators/access.validator';
import { queryAssetSchema } from '../validators/asset.validator';
import { queryLicenseSchema } from '../validators/license.validator';
import { queryTenantSchema } from '../validators/tenant.validator';
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

  it('rejects malformed cursor values and limits', () => {
    expect(queryAccessLogSchema.safeParse({ limit: 'abc' }).success).toBe(false);
    expect(queryAuditLogSchema.safeParse({ limit: 'abc' }).success).toBe(false);
    expect(queryAccessLogSchema.safeParse({ cursor: 'abc' }).success).toBe(false);
    expect(queryAuditLogSchema.safeParse({ cursor: '-1' }).success).toBe(false);
  });
});

describe('license numeric filters', () => {
  it('rejects malformed and out-of-range numeric filters', () => {
    expect(queryLicenseSchema.safeParse({ licenseTypeId: '2x' }).success).toBe(false);
    expect(queryLicenseSchema.safeParse({ licenseTypeId: '2147483648' }).success).toBe(false);
    expect(queryLicenseSchema.safeParse({ expiringWithinDays: '-1' }).success).toBe(false);
    expect(queryLicenseSchema.safeParse({ minCost: 'NaN' }).success).toBe(false);
    expect(queryLicenseSchema.safeParse({ maxCost: '1e2' }).success).toBe(false);
    expect(queryLicenseSchema.safeParse({ minCost: '10', maxCost: '9.99' }).success).toBe(false);
  });

  it('accepts valid zero-day and decimal cost filters', () => {
    const result = queryLicenseSchema.safeParse({
      licenseTypeId: '12',
      expiringWithinDays: '0',
      minCost: '0',
      maxCost: '99.99',
    });

    expect(result.success).toBe(true);
  });
});


describe('tenant numeric filters', () => {
  it('rejects malformed, nonpositive, and out-of-range plan IDs', () => {
    expect(queryTenantSchema.safeParse({ planId: '2x' }).success).toBe(false);
    expect(queryTenantSchema.safeParse({ planId: '0' }).success).toBe(false);
    expect(queryTenantSchema.safeParse({ planId: '2147483648' }).success).toBe(false);
  });

  it('accepts valid positive plan IDs', () => {
    expect(queryTenantSchema.safeParse({ planId: '12' }).success).toBe(true);
  });
});
