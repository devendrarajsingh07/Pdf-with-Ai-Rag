import { Router } from 'express';
import { MLService } from '../services/ml.service';
import { pool } from '../config/database';
import { env } from '../config/env';
import { getRedis } from '../services/request-security';

const router = Router();

router.get('/ping', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: {
    service: 'documind-api', apiVersion: 'v1', serverTime: new Date().toISOString(),
  } });
});

router.get('/', (req, res) => {
  res.json({ success: true, uptime: process.uptime(), status: 'OK' });
});

router.get('/readiness', async (_req, res) => {
  const checks = { database: false, ml: false, redis: false, queueEnabled: env.QUEUE_ENABLED };
  await Promise.all([
    pool.query('SELECT 1').then(() => { checks.database = true; }).catch(() => {}),
    MLService.healthCheck().then(health => { checks.ml = health.status === 'ok'; }).catch(() => {}),
    env.REDIS_URL ? getRedis().then(client => client.ping()).then(() => { checks.redis = true; }).catch(() => {}) : Promise.resolve(),
  ]);
  const ready = checks.database && checks.ml && checks.redis && checks.queueEnabled;
  res.status(ready ? 200 : 503).json({ success: ready, checks,
    note: 'Dependency readiness only; this is not a security certification or a live Gemini quota check.' });
});

router.get('/ml', async (req, res, next) => {
  try {
    const health = await MLService.healthCheck();
    res.json({ success: true, mlService: health });
  } catch (error) {
    next(error);
  }
});

export default router;
