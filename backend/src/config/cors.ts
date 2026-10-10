import { CorsOptions } from 'cors';
import { env } from './env';
import { ForbiddenError } from '../utils/errors';

// One strict allowlist for both browser CORS and cookie-based mutation protection.
export const allowedOrigins = new Set(env.CORS_ORIGIN.split(',').map(value => {
  const origin = value.trim();
  let url: URL;
  try { url = new URL(origin); } catch { throw new Error('CORS_ORIGIN must contain HTTP(S) origins'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error('CORS_ORIGIN must contain exact HTTP(S) origins without paths or wildcards');
  }
  return origin;
}));

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Non-browser reads have no Origin; mutation middleware still rejects them.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new ForbiddenError('Request origin is not allowed'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  maxAge: 600,
};
