import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Same generic message for "no such user" and "wrong password" so the endpoint
  // never reveals whether an email is registered (avoids user enumeration).
  if (!user) throw new ApiError(401, 'Invalid email or password');
  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');
  // Stateless, short-lived (8h) session token. The same payload is returned for
  // client-side display and later re-read as req.user once verified.
  const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
  res.json({ token, user: payload });
}
