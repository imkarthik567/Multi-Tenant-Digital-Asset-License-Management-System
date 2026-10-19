import { z } from 'zod';

// UUID-backed route parameters are validated before they reach Prisma queries.
export const uuidIdParamsSchema = z
  .object({ id: z.string().uuid('ID must be a valid UUID') })
  .strip();

export const licenseAssetLinkParamsSchema = z
  .object({
    id: z.string().uuid('License ID must be a valid UUID'),
    assetId: z.string().uuid('Asset ID must be a valid UUID'),
  })
  .strip();
