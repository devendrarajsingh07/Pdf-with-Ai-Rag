// Uses real Redis and retained secrets supplied by the PowerShell verifier.
// Every probe is namespaced and expires; never flush shared state.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const requireBackend = createRequire(require('node:path').resolve(__dirname, '../backend/package.json'));
const { createClient } = requireBackend('redis');
const { seal, unseal, admitUser, getRedis } = require('../backend/dist/services/request-security');
const { env } = require('../backend/dist/config/env');

(async () => {
  const unauthenticated = createClient({ url: 'redis://127.0.0.1:6380', socket: { reconnectStrategy: false } });
  unauthenticated.on('error', () => {});
  let denied = false;
  try { await unauthenticated.connect(); await unauthenticated.ping(); }
  catch { denied = true; }
  finally { if (unauthenticated.isOpen) await unauthenticated.disconnect(); }
  assert.ok(denied, 'Unauthenticated Redis access must be denied');
  const redis = await getRedis();
  const probe = randomUUID();
  const aad = `verification:${probe}`;
  const ciphertext = seal({ marker: 'roundtrip' }, aad);
  const key = `rag:verification:${probe}`;
  try {
    await redis.set(key, ciphertext, { EX: 120 });
    assert.deepEqual(unseal(await redis.get(key), aad), { marker: 'roundtrip' });
    assert.throws(() => unseal(ciphertext, 'different-owner'));
    const limitBefore = env.USER_API_REQUESTS_PER_MINUTE;
    env.USER_API_REQUESTS_PER_MINUTE = 2;
    try {
      await admitUser(probe); await admitUser(probe);
      await assert.rejects(admitUser(probe), error => error.code === 'USER_RATE_LIMIT');
    } finally { env.USER_API_REQUESTS_PER_MINUTE = limitBefore; }
    console.log('PASS real Redis authentication, encrypted roundtrip/AAD and atomic admission limit');
  } finally {
    await redis.del(key);
    await redis.quit();
  }
})().catch(() => { console.error('Real Redis verification failed (details suppressed to protect credentials)'); process.exitCode = 1; });
