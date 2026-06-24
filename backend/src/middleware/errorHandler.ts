import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiError';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'Route not found'));
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation failed', errors: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }
  // Safety net: malformed input that reaches Prisma should degrade to a 4xx,
  // not a 500. P2025 = record required by the operation was not found.
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ message: 'Invalid request' });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    return res.status(404).json({ message: 'Resource not found' });
  }
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}
