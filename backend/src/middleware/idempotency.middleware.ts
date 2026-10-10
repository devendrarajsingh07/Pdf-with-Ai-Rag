import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth.middleware';
import { env } from '../config/env';
import { validateIdempotencyKey } from '../services/job.service';

export function requireJobKey(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    if (env.QUEUE_ENABLED) validateIdempotencyKey(req.get('Idempotency-Key'));
    next();
  } catch (error) { next(error); }
}
