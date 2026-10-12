import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.util';
import { UnauthorizedError } from '../errors/AppError';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new UnauthorizedError('Authentication token not provided');
  }

  const user = verifyAccessToken(token);
  req.user = user;
  next();
};
