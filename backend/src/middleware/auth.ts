import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { ApiError } from '../utils/apiError';

export type AuthUser = { id: string; email: string; name: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Gate for every protected route: verifies the Bearer JWT's signature and
// expiry, then attaches the decoded user to req.user. A missing header and an
// invalid/expired token both surface as 401 so the client can re-authenticate.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required');
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
}

// Reusable role gate; assumes requireAuth has already populated req.user.
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new ApiError(401, 'Authentication required');
    if (req.user.role !== role) throw new ApiError(403, 'Forbidden');
    next();
  };
}
