import { Request, Response, NextFunction } from 'express';
import { allowedOrigins } from '../config/cors';
import { ForbiddenError } from '../utils/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyMutationOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin || !allowedOrigins.has(origin)) {
    return next(new ForbiddenError('Request origin is not allowed'));
  }
  next();
}
