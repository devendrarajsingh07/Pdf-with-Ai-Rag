import request from 'supertest';
import app from '../src/app';
import { db } from '../src/config/database';
import { users, messages, chatSessions, documents, jobs } from '../src/models';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';

describe('Auth Endpoints', () => {
  beforeEach(async () => {
    await db.delete(jobs);
    await db.delete(messages);
    await db.delete(chatSessions);
    await db.delete(documents);
    await db.delete(users);
  });

  afterAll(async () => {
    await db.delete(jobs);
    await db.delete(messages);
    await db.delete(chatSessions);
    await db.delete(documents);
    await db.delete(users);
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', env.CORS_ORIGIN)
        .send({
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('should fail if email is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', env.CORS_ORIGIN)
        .send({
          name: 'Test User',
          password: 'password123',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail for duplicate email', async () => {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);
      await db.insert(users).values({ email: 'test@example.com', name: 'Test User', passwordHash });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', env.CORS_ORIGIN)
        .send({
          email: 'test@example.com',
          name: 'Another User',
          password: 'password123',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);
      await db.insert(users).values({ email: 'test@example.com', name: 'Test User', passwordHash });
    });

    it('should login successfully and set cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', env.CORS_ORIGIN)
        .send({
          email: 'test@example.com',
          password: 'password123',
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeUndefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should fail on wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', env.CORS_ORIGIN)
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
