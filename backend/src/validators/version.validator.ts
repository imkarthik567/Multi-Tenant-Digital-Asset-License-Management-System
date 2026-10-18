// ==============================================================================
// AssetVault: Asset Version Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createVersionSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const rawSize = val.fileSize !== undefined ? val.fileSize : val.fileSizeBytes;
      const rawChecksum = val.checksum !== undefined ? val.checksum : val.checksumSha256;
      const rawChangelog = val.changelog !== undefined ? val.changelog : val.changeNotes;

      const fileSize =
        typeof rawSize === 'string' && rawSize.trim() !== ''
          ? Number(rawSize)
          : rawSize;

      return {
        ...val,
        fileUrl: val.fileUrl,
        fileSize,
        checksum: rawChecksum,
        changelog: rawChangelog ?? null,
        fileSizeBytes: fileSize,
        checksumSha256: rawChecksum,
        changeNotes: rawChangelog ?? null,
      };
    }
    return val;
  },
  z
    .object({
      fileUrl: z.string().url('fileUrl must be a valid URL'),
      fileSize: z
        .number()
        .int()
        .positive('fileSize must be a positive integer in bytes')
        .max(Number.MAX_SAFE_INTEGER, 'fileSize exceeds the safely representable byte range'),
      checksum: z
        .string()
        .trim()
        .regex(/^[a-fA-F0-9]{64}$/, 'SHA-256 checksum must be exactly 64 hexadecimal characters'),
      changelog: z.string().max(1000).optional().nullable(),
      fileSizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
      checksumSha256: z
        .string()
        .trim()
        .regex(/^[a-fA-F0-9]{64}$/, 'SHA-256 checksum must be exactly 64 hexadecimal characters')
        .optional(),
      changeNotes: z.string().max(1000).optional().nullable(),
    })
    .passthrough()
);

const positiveVersionNumber = z.preprocess(
  (value: unknown) =>
    typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value,
  z.number().int().positive().max(2147483647)
);

export const versionNoParamsSchema = z
  .object({
    id: z.string().uuid(),
    versionNo: z
      .string()
      .regex(/^[1-9]\d*$/, 'Version number must be a positive integer')
      .refine((value) => Number(value) <= 2147483647, 'Version number exceeds the supported range'),
  })
  .strip();

export const compareVersionsQuerySchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const rawFrom = val.from !== undefined ? val.from : val.v1;
      const rawTo = val.to !== undefined ? val.to : val.v2;

      return { from: rawFrom, to: rawTo };
    }
    return val;
  },
  z
    .object({
      from: positiveVersionNumber,
      to: positiveVersionNumber,
    })
    .strip()
);
