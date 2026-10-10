import request from 'supertest';
import app from '../src/app';
import { db } from '../src/config/database';
import { users, documents, jobs } from '../src/models';
import { AuthService } from '../src/services/auth.service';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';

// Mock ml service to not make actual HTTP calls during test
jest.mock('../src/services/ml.service', () => ({
  MLService: {
    processDocument: jest.fn().mockResolvedValue({ success: true }),
    deleteDocument: jest.fn().mockResolvedValue({ success: true }),
    reindexDocument: jest.fn().mockResolvedValue({ chunks_created: 2, pages_processed: 1 }),
  },
}));

describe('Document Endpoints', () => {
  let token: string;
  let userId: string;
  let otherToken: string;

  beforeAll(async () => {
    await db.delete(jobs);
    await db.delete(documents);
    await db.delete(users);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    const [user] = await db.insert(users).values({
      email: 'testdoc@example.com',
      name: 'Doc User',
      passwordHash,
    }).returning();
    userId = user.id;

    token = AuthService.generateToken(user.id, user.email);

    const [otherUser] = await db.insert(users).values({
      email: 'otherdoc@example.com',
      name: 'Other User',
      passwordHash,
    }).returning();
    otherToken = AuthService.generateToken(otherUser.id, otherUser.email);
  });

  afterAll(async () => {
    await db.delete(documents);
    await db.delete(users);
  });

  describe('GET /api/v1/documents', () => {
    it('should return empty list initially', async () => {
      const res = await request(app)
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  it('returns status without exposing private file fields', async () => {
    const [document] = await db.insert(documents).values({
      userId, name: 'status.pdf', originalName: 'status-original.pdf',
      filePath: 'uploads/status.pdf', fileSize: 10, mimeType: 'application/pdf', status: 'ready',
    }).returning();

    const detail = await request(app)
      .get(`/api/v1/documents/${document.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.filePath).toBeUndefined();
    expect(detail.body.data.mlDocumentId).toBeUndefined();

    const status = await request(app)
      .get(`/api/v1/documents/${document.id}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.data.status).toBe('ready');
  });

  it('rejects cross-user document access', async () => {
    const [document] = await db.insert(documents).values({
      userId, name: 'private.pdf', originalName: 'private.pdf',
      filePath: 'uploads/private.pdf', fileSize: 10, mimeType: 'application/pdf', status: 'ready',
    }).returning();
    const res = await request(app)
      .get(`/api/v1/documents/${document.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('starts reindexing for an owned document', async () => {
    const [document] = await db.insert(documents).values({
      userId, name: 'reindex.pdf', originalName: 'reindex.pdf',
      filePath: 'uploads/reindex.pdf', fileSize: 10, mimeType: 'application/pdf', status: 'failed',
    }).returning();
    const res = await request(app)
      .post(`/api/v1/documents/${document.id}/reindex`)
      .set('Origin', env.CORS_ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Reindexing started');
  });

  it('deletes an owned document', async () => {
    const [document] = await db.insert(documents).values({
      userId, name: 'delete-test.pdf', originalName: 'delete-test.pdf',
      filePath: 'uploads/delete-test.pdf', fileSize: 10, mimeType: 'application/pdf', status: 'ready',
    }).returning();
    const res = await request(app)
      .delete(`/api/v1/documents/${document.id}`)
      .set('Origin', env.CORS_ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const remaining = await db.select().from(documents);
    expect(remaining.some((item) => item.id === document.id)).toBe(false);
  });

  it('rejects a file whose content is not PDF data', async () => {
    const res = await request(app)
      .post('/api/v1/documents/upload')
      .set('Origin', env.CORS_ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PDF');
  });
});
