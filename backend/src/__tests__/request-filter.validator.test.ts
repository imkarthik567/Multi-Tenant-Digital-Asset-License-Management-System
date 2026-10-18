import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { getPaginationParams } from '../utils/pagination.util';
import { queryAccessLogSchema } from '../validators/access.validator';
import { queryAssetSchema } from '../validators/asset.validator';
import { queryLicenseSchema } from '../validators/license.validator';
import { queryTenantSchema } from '../validators/tenant.validator';
import { planIdParamsSchema } from '../validators/plan.validator';
import { compareVersionsQuerySchema, createVersionSchema, versionNoParamsSchema } from '../validators/version.validator';
import { runExpiryCheckSchema } from '../validators/notification.validator';
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


describe('plan ID route parameters', () => {
  it('rejects malformed, nonpositive, and out-of-range IDs', () => {
    expect(planIdParamsSchema.safeParse({ id: '3x' }).success).toBe(false);
    expect(planIdParamsSchema.safeParse({ id: '0' }).success).toBe(false);
    expect(planIdParamsSchema.safeParse({ id: '2147483648' }).success).toBe(false);
  });

  it('accepts a valid positive plan ID', () => {
    expect(planIdParamsSchema.safeParse({ id: '3' }).success).toBe(true);
  });
});


describe('asset version number inputs', () => {
  it('rejects malformed and out-of-range version numbers', () => {
    expect(versionNoParamsSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', versionNo: '2x' }).success).toBe(false);
    expect(versionNoParamsSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', versionNo: '2147483648' }).success).toBe(false);
    expect(compareVersionsQuerySchema.safeParse({ from: '2x', to: '3' }).success).toBe(false);
    expect(compareVersionsQuerySchema.safeParse({ from: '1e2', to: '3' }).success).toBe(false);
    expect(compareVersionsQuerySchema.safeParse({ from: '2147483648', to: '3' }).success).toBe(false);
  });

  it('accepts positive integer values and legacy comparison aliases', () => {
    expect(versionNoParamsSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', versionNo: '2' }).success).toBe(true);
    const result = compareVersionsQuerySchema.safeParse({ v1: '2', v2: '3' });
    expect(result.success && result.data).toEqual({ from: 2, to: 3 });
  });
});


describe('expiry check day count', () => {
  it('rejects malformed and out-of-range lookahead values', () => {
    expect(runExpiryCheckSchema.safeParse({ lookaheadDays: '2x' }).success).toBe(false);
    expect(runExpiryCheckSchema.safeParse({ lookaheadDays: '1e2' }).success).toBe(false);
    expect(runExpiryCheckSchema.safeParse({ lookaheadDays: '366' }).success).toBe(false);
  });

  it('accepts valid day counts and the legacy alias', () => {
    const result = runExpiryCheckSchema.safeParse({ daysAhead: '30' });
    expect(result.success && result.data.lookaheadDays).toBe(30);
    expect(runExpiryCheckSchema.safeParse({ lookaheadDays: '1' }).success).toBe(true);
  });
});


describe('asset version file size precision', () => {
  it('rejects byte counts beyond JavaScript safe integer precision', () => {
    const result = createVersionSchema.safeParse({
      fileUrl: 'https://assets.example.test/version.bin',
      fileSize: '9007199254740992',
      checksum: 'a'.repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it('accepts the largest safely representable byte count', () => {
    const result = createVersionSchema.safeParse({
      fileUrl: 'https://assets.example.test/version.bin',
      fileSize: '9007199254740991',
      checksum: 'a'.repeat(64),
    });
    expect(result.success).toBe(true);
  });
});


describe('pagination parameters', () => {
  const requestWithQuery = (query: Record<string, string>) => ({ query } as unknown as Request);

  it('falls back to defaults for malformed numeric strings', () => {
    const params = getPaginationParams(requestWithQuery({ page: '2x', limit: '3x' }));
    expect(params).toMatchObject({ page: 1, limit: 10, skip: 0 });
  });

  it('accepts whole numbers and caps page size at 100', () => {
    const params = getPaginationParams(requestWithQuery({ page: '4', limit: '250' }));
    expect(params).toMatchObject({ page: 4, limit: 100, skip: 300 });
  });

  it('falls back when a requested page would produce an unsafe offset', () => {
    const params = getPaginationParams(
      requestWithQuery({ page: '9007199254740992', limit: '100' })
    );
    expect(params).toMatchObject({ page: 1, limit: 100, skip: 0 });
  });
});
