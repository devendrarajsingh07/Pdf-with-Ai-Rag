import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ML_SERVICE_URL: z.string().url(),
  ML_SERVICE_TOKEN: z.string().min(32),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().default('52428800').transform(Number),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  REDIS_URL: z.string().url().optional(),
  QUEUE_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  DATA_ENCRYPTION_KEY: z.string().optional(),
  USER_API_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten());
  process.exit(1);
}
export const env = parsed.data;
if (env.QUEUE_ENABLED && (!env.REDIS_URL || !env.DATA_ENCRYPTION_KEY || !/^[A-Za-z0-9+/]{43}=$/.test(env.DATA_ENCRYPTION_KEY) || Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64').length !== 32)) {
  throw new Error('Queue mode requires REDIS_URL and a base64-encoded 32-byte DATA_ENCRYPTION_KEY');
}
