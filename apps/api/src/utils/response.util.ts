import { Response } from 'express';
import { PaginationMeta } from './pagination.util';

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  meta?: PaginationMeta | Record<string, unknown>
): void => {
  res.status(statusCode).json({
    data,
    ...(meta ? { meta } : {}),
  });
};
