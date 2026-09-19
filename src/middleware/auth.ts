import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        username: string;
      };
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Verifies the access token, and re-checks the user still exists and the token wasn't revoked (tokenVersion). */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Missing bearer token.');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token.');
  }

  const user = await User.findById(payload.sub).select('tokenVersion role username').lean();
  if (!user) throw ApiError.unauthorized('User no longer exists.');
  if (user.tokenVersion !== payload.tv) throw ApiError.unauthorized('Session has been invalidated. Please log in again.');

  req.user = { id: payload.sub, role: user.role, username: user.username };
  next();
});

/** Restricts a route to one or more roles. Always used AFTER requireAuth. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Your role cannot access this resource.'));
    next();
  };
}

/** Optional auth: attaches req.user if a valid token is present, but never rejects the request. Used by public/verify endpoints that behave slightly differently when logged in. */
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('tokenVersion role username').lean();
    if (user && user.tokenVersion === payload.tv) {
      req.user = { id: payload.sub, role: user.role, username: user.username };
    }
  } catch {
    // ignore invalid token for optional auth
  }
  next();
});
