import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types';
import { isTestAccessEnabled } from '../config/testAccess';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  district?: string;
  testAccess?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const tokenSecret = () => process.env.AUTH_TOKEN_SECRET || 'local-development-only-change-this-secret';

export const signAuthToken = (user: AuthenticatedUser): string => {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 })).toString('base64url');
  const signature = createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ success: false, error: { message: 'Authentication required', code: 'UNAUTHENTICATED' } });
    return;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    res.status(401).json({ success: false, error: { message: 'Invalid authentication token', code: 'INVALID_TOKEN' } });
    return;
  }

  const expected = createHmac('sha256', tokenSecret()).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    received = Buffer.alloc(0);
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    res.status(401).json({ success: false, error: { message: 'Invalid authentication token', code: 'INVALID_TOKEN' } });
    return;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AuthenticatedUser & { exp: number };
    if (!decoded.id || !decoded.role || decoded.exp <= Date.now() / 1000) throw new Error('Expired token');
    if (decoded.testAccess === true && !isTestAccessEnabled()) throw new Error('Test access is disabled');
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      district: decoded.district,
      testAccess: decoded.testAccess === true,
    };
    next();
  } catch {
    res.status(401).json({ success: false, error: { message: 'Authentication token has expired or is invalid', code: 'INVALID_TOKEN' } });
  }
};

export const allowRoles = (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ success: false, error: { message: 'You do not have permission to perform this action', code: 'FORBIDDEN' } });
    return;
  }
  next();
};

export const isDmcOfficer = (role?: UserRole) =>
  role === UserRole.DMC_DUTY_OFFICER || role === UserRole.DMC_OFFICER;