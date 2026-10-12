import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  q?: string;
  sort: string;
  order: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const getPaginationParams = (req: Request, defaultSort = 'createdAt'): PaginationParams => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const skip = (page - 1) * limit;
  const q = typeof req.query.q === 'string' && req.query.q.trim().length > 0 ? req.query.q.trim() : undefined;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : defaultSort;
  const order = req.query.order === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    q,
    sort,
    order,
  };
};

export const createPaginationMeta = (total: number, page: number, limit: number): PaginationMeta => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};
