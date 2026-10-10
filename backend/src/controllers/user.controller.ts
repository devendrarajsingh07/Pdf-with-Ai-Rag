import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { db } from '../config/database';
import { users } from '../models';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../utils/errors';
import { z } from 'zod';

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
  }),
});

export class UserController {
  static async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, req.user!.id)).limit(1);

      if (!user) throw new NotFoundError('User');

      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name } = updateSchema.parse(req).body;

      const [user] = await db.update(users)
        .set({ name, updatedAt: new Date() })
        .where(eq(users.id, req.user!.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
        });

      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}
