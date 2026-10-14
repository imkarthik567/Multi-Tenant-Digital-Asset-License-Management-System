// ==============================================================================
// AssetVault: JWT Authentication Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Extracts and verifies Bearer access token signature & expiration
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.util';
import { UnauthorizedError } from '../errors/AppError';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const [scheme, val] = authHeader.split(' ');
    if (scheme && scheme.toLowerCase() === 'bearer' && val) {
      token = val;
    } else {
      throw new UnauthorizedError('Invalid authorization scheme. Format: Bearer <token>');
    }
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    throw new UnauthorizedError('Authorization header missing');
  }

  const decoded = verifyAccessToken(token);

  req.jwtUser = {
    sub: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    tenantId: decoded.tenantId,
  };

  next();
};
