import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req as AuthRequest).user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many chat messages' } },
});

router.post('/', ChatController.createSession);
router.get('/', ChatController.getUserSessions);
router.get('/:id', ChatController.getSession);
router.delete('/:id', ChatController.deleteSession);

router.post('/:id/messages', messageLimiter, ChatController.sendMessage);
router.get('/:id/messages', ChatController.getMessages);

export default router;
