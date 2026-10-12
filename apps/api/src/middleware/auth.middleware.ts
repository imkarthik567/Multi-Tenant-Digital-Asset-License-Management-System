// ==============================================================================
// AssetVault: JWT Authentication Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Extracts and verifies Bearer access token signature & expiration
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.util';
import { UnauthorizedError } from '../errors/AppError';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Authorization header missing');
  }

  const [scheme, token] = authHeader.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedError('Invalid authorization scheme. Format: Bearer <token>');
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
