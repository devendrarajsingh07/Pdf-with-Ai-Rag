import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { db } from '../config/database';
import { users } from '../models';
import { UnauthorizedError } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('Not authenticated. Please log in.');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { id: string; email: string };
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, decoded.id)).limit(1);

    if (!user) {
      res.clearCookie('token');
      throw new UnauthorizedError('Your session is no longer valid. Please log in again.');
    }

    req.user = user;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired. Please log in again.'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token. Please log in again.'));
    } else {
      next(error);
    }
  }
};
