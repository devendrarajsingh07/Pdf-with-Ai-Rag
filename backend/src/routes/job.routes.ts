import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { JobService } from '../services/job.service';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const router = Router();
router.use(authenticate);
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!env.QUEUE_ENABLED) throw new AppError('Queue mode is not enabled', 503, 'QUEUE_DISABLED');
    const id = z.string().uuid().parse(req.params.id);
    res.json({ success: true, data: await JobService.get(id, req.user!.id) });
  } catch (error) { next(error); }
});
export default router;
