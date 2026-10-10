import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/config/database';
import { env } from '../src/config/env';
import { users, documents, chatSessions, messages, jobs } from '../src/models';
import { JobService } from '../src/services/job.service';
import { seal, unseal, admitUser } from '../src/services/request-security';
import { MLService } from '../src/services/ml.service';
import { AppError } from '../src/utils/errors';

jest.mock('../src/services/request-security', () => ({
  ...jest.requireActual('../src/services/request-security'),
  admitUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/ml.service', () => ({ MLService: { chat: jest.fn().mockResolvedValue({ answer: 'Answer', citations: [] }) } }));

describe('Durable request jobs', () => {
  let userId: string, sessionId: string;
  beforeAll(async () => {
    env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    await db.delete(jobs); await db.delete(messages); await db.delete(chatSessions); await db.delete(documents); await db.delete(users);
    const [user] = await db.insert(users).values({ email: 'job@example.test', name: 'Job Test', passwordHash: 'test-only' }).returning();
    userId = user.id;
    const [doc] = await db.insert(documents).values({ userId, name: 'test.pdf', originalName: 'test.pdf',
      filePath: 'test.pdf', fileSize: 100, mimeType: 'application/pdf', status: 'ready' }).returning();
    const [session] = await db.insert(chatSessions).values({ userId, title: 'Test', documentIds: [doc.id] }).returning();
    sessionId = session.id;
  });
  afterEach(async () => {
    await db.delete(jobs); await db.delete(messages);
    jest.mocked(admitUser).mockResolvedValue(undefined); jest.mocked(MLService.chat).mockClear();
  });
  afterAll(async () => {
    await db.delete(chatSessions); await db.delete(documents); await db.delete(users);
  });

  it('encrypts with authenticated associated data and rejects tampering', () => {
    const encrypted = seal({ text: 'private' }, 'owner:request');
    expect(encrypted).not.toContain('private');
    expect(unseal(encrypted, 'owner:request')).toEqual({ text: 'private' });
    expect(() => unseal(encrypted, 'different-owner')).toThrow();
  });

  it('replays identical keys, rejects conflicting bodies, and charges admission once', async () => {
    const key = randomUUID();
    const first = await JobService.enqueueChat(userId, sessionId, 'Question', key);
    const second = await JobService.enqueueChat(userId, sessionId, 'Question', key);
    expect(first.id).toBe(second.id);
    expect(jest.mocked(admitUser).mock.calls.length).toBe(1);
    await expect(JobService.enqueueChat(userId, sessionId, 'Changed', key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    jest.mocked(admitUser).mockClear();
  });

  it('commits one message exchange and encrypted result atomically', async () => {
    const job = await JobService.enqueueChat(userId, sessionId, 'Question', randomUUID());
    expect(await JobService.workOnce()).toBe(true);
    const status = await JobService.get(job.id, userId);
    expect(status.status).toBe('completed');
    expect(status.result).toMatchObject({ assistantMessage: { content: 'Answer' } });
    expect((await db.select().from(messages)).length).toBe(2);
    expect(await JobService.workOnce()).toBe(false);
    await expect(JobService.get(job.id, randomUUID())).rejects.toThrow();
  });

  it('runs shortest estimates first within a priority tier', async () => {
    const first = await JobService.enqueue(userId, randomUUID(), 'chat', sessionId,
      { sessionId, question: 'Large' }, { question: 'Large' }, 20000);
    const second = await JobService.enqueue(userId, randomUUID(), 'chat', sessionId,
      { sessionId, question: 'Small' }, { question: 'Small' }, 100);
    await JobService.workOnce();
    expect((await JobService.get(second.id, userId)).status).toBe('completed');
    expect((await JobService.get(first.id, userId)).status).toBe('queued');
  });

  it('does not enqueue or call ML when the user has reached their limit', async () => {
    jest.mocked(admitUser).mockRejectedValueOnce(new AppError('Rate limited', 429, 'USER_RATE_LIMIT'));
    await expect(JobService.enqueueChat(userId, sessionId, 'Question', randomUUID())).rejects.toMatchObject({ code: 'USER_RATE_LIMIT' });
    expect((await db.select().from(jobs)).length).toBe(0);
    expect(MLService.chat).not.toHaveBeenCalled();
  });

  it('recovers a crashed job lease with a new attempt', async () => {
    const job = await JobService.enqueueChat(userId, sessionId, 'Question', randomUUID());
    await db.update(jobs).set({ status: 'processing', attempts: 1, leaseOwner: 'dead-worker', leaseUntil: new Date(0) }).where(eq(jobs.id, job.id));
    await JobService.workOnce();
    const recovered = await JobService.get(job.id, userId);
    expect(recovered.status).toBe('completed');
    expect(recovered.attempts).toBe(2);
  });

  it('ages older large jobs ahead of newly submitted small jobs', async () => {
    const large = await JobService.enqueue(userId, randomUUID(), 'chat', sessionId,
      { sessionId, question: 'Large' }, { question: 'Large' }, 20000);
    await db.update(jobs).set({ createdAt: new Date(Date.now() - 360000) }).where(eq(jobs.id, large.id));
    const small = await JobService.enqueue(userId, randomUUID(), 'chat', sessionId,
      { sessionId, question: 'Small' }, { question: 'Small' }, 100);
    await JobService.workOnce();
    expect((await JobService.get(large.id, userId)).status).toBe('completed');
    expect((await JobService.get(small.id, userId)).status).toBe('queued');
  });

  it('rejects a stale worker before it can commit', async () => {
    const job = await JobService.enqueueChat(userId, sessionId, 'Question', randomUUID());
    await expect(db.transaction(tx => JobService.fence(tx, job.id, 'wrong-worker'))).rejects.toMatchObject({ code: 'LEASE_LOST' });
    expect((await db.select().from(messages)).length).toBe(0);
  });
});
