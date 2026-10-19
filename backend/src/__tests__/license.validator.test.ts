import { describe, expect, it } from 'vitest';
import {
  createLicenseSchema,
  renewLicenseSchema,
  updateLicenseSchema,
} from '../validators/license.validator';

describe('license date validation', () => {
  it('rejects impossible calendar dates instead of normalizing them', () => {
    expect(updateLicenseSchema.safeParse({ endDate: '2026-02-31' }).success).toBe(false);
    expect(
      renewLicenseSchema.safeParse({ newEndDate: '2026-02-31', cost: 0 }).success
    ).toBe(false);
  });

  it('rejects malformed create and update date strings', () => {
    const createResult = createLicenseSchema.safeParse({
      name: 'Example License',
      vendorId: '00000000-0000-4000-8000-000000000001',
      licenseTypeId: 1,
      licenseKey: 'KEY-1234',
      totalSeats: 5,
      startDate: 'not-a-date',
    });
    const updateResult = updateLicenseSchema.safeParse({ endDate: 'not-a-date' });

    expect(createResult.success).toBe(false);
    expect(updateResult.success).toBe(false);
  });

  it('rejects malformed renewal dates before they reach the database', () => {
    const result = renewLicenseSchema.safeParse({
      newEndDate: 'not-a-date',
      cost: 0,
    });

    expect(result.success).toBe(false);
  });

  it('accepts date-only strings and an explicit null end date in partial updates', () => {
    const createResult = createLicenseSchema.safeParse({
      name: 'Example License',
      vendorId: '00000000-0000-4000-8000-000000000001',
      licenseTypeId: 1,
      licenseKey: 'KEY-1234',
      totalSeats: 5,
      startDate: '2026-01-01',
    });
    const updateResult = updateLicenseSchema.safeParse({ endDate: null });

    expect(createResult.success).toBe(true);
    expect(updateResult.success).toBe(true);
    if (createResult.success) {
      expect(createResult.data.startDate).toEqual(new Date('2026-01-01'));
    }
  });
});
