import { z } from 'zod';

const POSTGRES_BIGINT_MAX = '9223372036854775807';

export const cursorIdSchema = z
  .string()
  .regex(/^\d+$/, 'cursor must be a non-negative integer')
  .refine((value) => {
    const canonical = value.replace(/^0+(?=\d)/, '');
    return canonical.length < POSTGRES_BIGINT_MAX.length ||
      (canonical.length === POSTGRES_BIGINT_MAX.length && canonical <= POSTGRES_BIGINT_MAX);
  }, 'cursor exceeds the supported database ID range');
