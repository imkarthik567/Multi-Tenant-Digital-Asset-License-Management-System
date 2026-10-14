// ==============================================================================
// AssetVault: Asset Version Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createVersionSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const fileSize = val.fileSize !== undefined ? val.fileSize : val.fileSizeBytes;
      const checksum = val.checksum !== undefined ? val.checksum : val.checksumSha256;
      const changelog = val.changelog !== undefined ? val.changelog : val.changeNotes;

      return {
        fileUrl: val.fileUrl,
        fileSize,
        fileSizeBytes: fileSize,
        checksum,
        checksumSha256: checksum,
        changelog,
        changeNotes: changelog,
      };
    }
    return val;
  },
  z
    .object({
      fileUrl: z.string().url('fileUrl must be a valid URL'),
      fileSize: z.coerce.number().int().positive('fileSize must be a positive integer in bytes'),
      fileSizeBytes: z.coerce.number().int().positive('fileSize must be a positive integer in bytes'),
      checksum: z.string().min(8).max(128).trim(),
      checksumSha256: z.string().min(8).max(128).trim(),
      changelog: z.string().max(1000).optional().nullable(),
      changeNotes: z.string().max(1000).optional().nullable(),
    })
    .strip()
);

export const compareVersionsQuerySchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const from = val.from !== undefined ? val.from : val.v1;
      const to = val.to !== undefined ? val.to : val.v2;
      return {
        from,
        to,
      };
    }
    return val;
  },
  z
    .object({
      from: z.coerce.number().int().positive('from must be a positive integer'),
      to: z.coerce.number().int().positive('to must be a positive integer'),
    })
    .strip()
);
