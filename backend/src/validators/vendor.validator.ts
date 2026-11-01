// ==============================================================================
// AssetVault: Vendor Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

const normalizeOptionalEmail = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    return trimmed === '' ? null : trimmed;
  }
  return val;
};

const normalizeOptionalWebsite = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed) && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }
  return val;
};

const normalizeOptionalPhone = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  }
  return val;
};

export const createVendorSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    contactEmail: z.preprocess(normalizeOptionalEmail, z.string().email().optional().nullable()),
    website: z.preprocess(normalizeOptionalWebsite, z.string().url().optional().nullable()),
    supportPhone: z.preprocess(normalizeOptionalPhone, z.string().max(30).optional().nullable()),
  })
  .strip();

export const updateVendorSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    contactEmail: z.preprocess(normalizeOptionalEmail, z.string().email().optional().nullable()),
    website: z.preprocess(normalizeOptionalWebsite, z.string().url().optional().nullable()),
    supportPhone: z.preprocess(normalizeOptionalPhone, z.string().max(30).optional().nullable()),
  })
  .strip();

export const queryVendorSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();
