import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { createSessionSchema, messageSchema, sessionParamsSchema } from '../validators/chat.validator';
import { env } from '../config/env';
import { JobService, validateIdempotencyKey } from '../services/job.service';

export class ChatController {
  static async createSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { title, documentIds } = createSessionSchema.parse(req).body;
      const session = await ChatService.createSession(req.user!.id, title, documentIds);
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async getUserSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sessions = await ChatService.getUserSessions(req.user!.id);
      res.status(200).json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  }

  static async getSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = sessionParamsSchema.parse(req).params;
      const session = await ChatService.getSession(id, req.user!.id);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = sessionParamsSchema.parse(req).params;
      await ChatService.deleteSession(id, req.user!.id);
      res.status(200).json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = sessionParamsSchema.parse(req).params;
      const messages = await ChatService.getMessages(id, req.user!.id);
      res.status(200).json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  static async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { question } = messageSchema.parse(req).body;
      const { id } = messageSchema.parse(req).params;
      if (env.QUEUE_ENABLED) {
        const job = await JobService.enqueueChat(req.user!.id, id, question, validateIdempotencyKey(req.get('Idempotency-Key')));
        res.status(202).json({ success: true, data: { jobId: job.id, status: job.status } });
        return;
      }
      
      const result = await ChatService.sendMessage(id, req.user!.id, question);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
