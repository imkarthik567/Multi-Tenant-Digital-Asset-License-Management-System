import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthUser } from '../@types/express';
import { generateSecureRandomString, hashToken } from './hash.util';
import { UnauthorizedError } from '../errors/AppError';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  fullName: string;
  tenantId: string;
  roleId: number;
  role: string;
  isSuperAdmin: boolean;
}

export const generateAccessToken = (user: AuthUser): string => {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    tenantId: user.tenantId,
    roleId: user.roleId,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): AuthUser => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    return {
      id: decoded.sub,
      email: decoded.email,
      fullName: decoded.fullName,
      tenantId: decoded.tenantId,
      roleId: decoded.roleId,
      role: decoded.role,
      isSuperAdmin: decoded.isSuperAdmin,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired', { expired: true });
    }
    throw new UnauthorizedError('Invalid access token');
  }
};

export const generateRefreshTokenData = () => {
  const rawToken = generateSecureRandomString(40);
  const tokenHash = hashToken(rawToken);
  // Default to 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
};
