import { z } from 'zod';

export function isValidDateString(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  // ECMAScript may normalize impossible date-only values (for example,
  // February 31) into a different month instead of rejecting them.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return date.toISOString().slice(0, 10) === value;
  }
  return true;
}

export const dateStringSchema = z.string().refine(isValidDateString, 'Must be a valid date');
