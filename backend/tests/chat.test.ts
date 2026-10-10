import request from 'supertest';
import app from '../src/app';
import { db } from '../src/config/database';
import { users, chatSessions, documents, messages, jobs } from '../src/models';
import { AuthService } from '../src/services/auth.service';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';
import { MLService } from '../src/services/ml.service';
import { eq } from 'drizzle-orm';

jest.mock('../src/services/ml.service', () => ({
  MLService: {
    chat: jest.fn().mockResolvedValue({
      answer: 'Mock answer [Source 1]',
      citations: [{
        document_id: 'doc-source', document_name: 'source.pdf', page_number: 2,
        chunk_id: 'chunk-1', excerpt: 'Evidence', relevance_score: 0.9,
      }],
    }),
  },
}));

describe('Chat Endpoints', () => {
  let token: string;
  let userId: string;
  let documentId: string;

  beforeAll(async () => {
    await db.delete(jobs);
    await db.delete(messages);
    await db.delete(chatSessions);
    await db.delete(documents);
    await db.delete(users);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    const [user] = await db.insert(users).values({
      email: 'testchat@example.com',
      name: 'Chat User',
      passwordHash,
    }).returning();
    userId = user.id;

    const [document] = await db.insert(documents).values({
      userId,
      name: 'stored.pdf',
      originalName: 'source.pdf',
      filePath: 'uploads/stored.pdf',
      fileSize: 10,
      mimeType: 'application/pdf',
      status: 'ready',
    }).returning();
    documentId = document.id;

    token = AuthService.generateToken(user.id, user.email);
  });

  afterAll(async () => {
    await db.delete(messages);
    await db.delete(chatSessions);
    await db.delete(documents);
    await db.delete(users);
  });

  describe('GET /api/v1/chat', () => {
    it('should return empty list initially', async () => {
      const res = await request(app)
        .get('/api/v1/chat')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/v1/chat', () => {
    it('should fail if documentIds is missing', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .set('Origin', env.CORS_ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'My Chat',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('chat happy path', () => {
    it('creates a session and persists normalized assistant citations', async () => {
      const createRes = await request(app)
        .post('/api/v1/chat')
        .set('Origin', env.CORS_ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test chat', documentIds: [documentId] });

      expect(createRes.status).toBe(201);

      const messageRes = await request(app)
        .post(`/api/v1/chat/${createRes.body.data.id}/messages`)
        .set('Origin', env.CORS_ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'What does it say?' });

      expect(messageRes.status).toBe(201);
      expect(messageRes.body.data.assistantMessage.citations[0]).toEqual({
        documentId: 'doc-source',
        documentName: 'source.pdf',
        pageNumber: 2,
        chunkId: 'chunk-1',
        excerpt: 'Evidence',
        relevanceScore: 0.9,
      });
    });

    it('does not save a half exchange when ML fails', async () => {
      const session = await request(app).post('/api/v1/chat')
        .set('Origin', env.CORS_ORIGIN).set('Authorization', `Bearer ${token}`)
        .send({ title: 'Failed exchange', documentIds: [documentId] });
      jest.mocked(MLService.chat).mockRejectedValueOnce(new Error('Simulated ML failure'));
      const response = await request(app).post(`/api/v1/chat/${session.body.data.id}/messages`)
        .set('Origin', env.CORS_ORIGIN).set('Authorization', `Bearer ${token}`)
        .send({ question: 'Fail safely' });
      expect(response.status).toBe(500);
      expect(response.body.error.message).not.toContain('Simulated');
      const saved = await db.select().from(messages).where(eq(messages.sessionId, session.body.data.id));
      expect(saved).toHaveLength(0);
    });

    it('rejects sessions whose selected documents have all been removed', async () => {
      const [session] = await db.insert(chatSessions).values({ userId, title: 'Empty scope', documentIds: [] }).returning();
      const callsBefore = jest.mocked(MLService.chat).mock.calls.length;
      const response = await request(app).post(`/api/v1/chat/${session.id}/messages`)
        .set('Origin', env.CORS_ORIGIN).set('Authorization', `Bearer ${token}`)
        .send({ question: 'Do not search unrelated documents' });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('NO_DOCUMENTS');
      expect(jest.mocked(MLService.chat).mock.calls.length).toBe(callsBefore);
    });
  });
});
