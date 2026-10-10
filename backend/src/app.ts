import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import chatRoutes from './routes/chat.routes';
import userRoutes from './routes/user.routes';
import healthRoutes from './routes/health.routes';
import { errorHandler } from './middleware/error.middleware';
import { verifyMutationOrigin } from './middleware/origin.middleware';
import jobRoutes from './routes/job.routes';
import { corsOptions } from './config/cors';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(verifyMutationOrigin);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // Permit status polling throughout a long PDF processing request.
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many login attempts' } },
});

app.use(generalLimiter);

// Routes
app.post('/api/v1/auth/login', authLimiter);
app.post('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/health', healthRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: 'Not Found' } });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
