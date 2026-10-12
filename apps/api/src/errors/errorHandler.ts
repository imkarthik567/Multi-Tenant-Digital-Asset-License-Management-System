import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handled AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input payload',
        details: err.flatten(),
      },
    });
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || [];
      res.status(409).json({
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: `Unique constraint failed on field(s): ${target.join(', ')}`,
          details: { fields: target },
        },
      });
      return;
    }

    // Record not found
    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
        },
      });
      return;
    }

    // Foreign key violation
    if (err.code === 'P2003') {
      res.status(400).json({
        error: {
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced foreign entity does not exist or relation constraint violated.',
        },
      });
      return;
    }
  }

  // 4. Default / Unhandled Internal Errors
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected internal server error occurred.' : err.message,
    },
  });
};
