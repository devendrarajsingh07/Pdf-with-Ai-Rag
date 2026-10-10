import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { createClient } from 'redis';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export function digest(value: string) {
  return createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');
}

function encryptionKey() {
  const key = Buffer.from(env.DATA_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('A separate 32-byte encryption key is required');
  return key;
}

export function seal(value: unknown, associatedData: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(associatedData));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}

export function unseal<T>(value: string, associatedData: string): T {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1') throw new Error('Unsupported encrypted record version');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(associatedData));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}

let redis: ReturnType<typeof createClient> | undefined;
let connection: Promise<unknown> | undefined;
export async function getRedis() {
  if (!env.REDIS_URL) throw new AppError('Redis is not configured', 503, 'REDIS_UNAVAILABLE');
  if (!redis) {
    redis = createClient({ url: env.REDIS_URL, socket: { connectTimeout: 3000, reconnectStrategy: false } });
    // Do not log URLs/credentials or raw client errors.
    redis.on('error', () => {});
  }
  if (!redis.isOpen) {
    connection ||= redis.connect().finally(() => { connection = undefined; });
    await connection;
  }
  return redis;
}

export const WINDOW_LIMIT_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then return {0, redis.call('PTTL', KEYS[1])} end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, redis.call('PTTL', KEYS[1])}`;

export async function admitUser(userId: string) {
  try {
    const client = await getRedis();
    const result = await client.eval(WINDOW_LIMIT_SCRIPT, {
      keys: [`rag:limit:user:${digest(userId)}`],
      arguments: [String(env.USER_API_REQUESTS_PER_MINUTE), '60000'],
    }) as number[];
    if (!result[0]) throw new AppError('Your request limit was reached. Please wait before retrying.', 429, 'USER_RATE_LIMIT');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Request coordination is unavailable. Please retry later.', 503, 'REDIS_UNAVAILABLE');
  }
}
