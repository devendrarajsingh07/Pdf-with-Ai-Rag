import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { registerSchema, loginSchema } from '../validators/auth.validator';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, name, password } = registerSchema.parse(req).body;
      const user = await AuthService.register(email, name, password);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req).body;
      const { user, token } = await AuthService.login(email, password);

      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie('token');
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // req.user is populated by auth middleware
      res.status(200).json({ success: true, data: req.user });
    } catch (error) {
      next(error);
    }
  }
}
