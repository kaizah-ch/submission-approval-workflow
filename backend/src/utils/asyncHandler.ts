import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not forward rejected promises from async handlers to the
// error middleware. This wrapper catches them so thrown async errors reach
// errorHandler instead of crashing the process.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
