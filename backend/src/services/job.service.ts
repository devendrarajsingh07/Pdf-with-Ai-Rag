import { randomUUID, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { eq, and, sql } from 'drizzle-orm';
import { db, pool } from '../config/database';
import { env } from '../config/env';
import { jobs, documents } from '../models';
import { AppError, NotFoundError } from '../utils/errors';
import { admitUser, digest, seal, unseal, getRedis } from './request-security';
import { ChatService } from './chat.service';
import { MLService } from './ml.service';
import { logger } from '../utils/logger';

type JobRow = typeof jobs.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Payload = { sessionId?: string; question?: string; filePath?: string; checksum?: string; originalName?: string };
export function validateIdempotencyKey(key: unknown): string {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
    throw new AppError('A 16–128 character Idempotency-Key header is required', 400, 'IDEMPOTENCY_KEY_REQUIRED');
  return key;
}
export async function fileChecksum(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}
function aad(job: Pick<JobRow, 'id' | 'userId' | 'kind'>) { return `${job.id}:${job.userId}:${job.kind}`; }

export class JobService {
  static async enqueue(userId: string, key: string, kind: string, resourceId: string, payload: Payload,
    fingerprint: unknown, estimate: number, prepare?: (tx: Transaction) => Promise<void>) {
    key = validateIdempotencyKey(key);
    const keyHash = digest(key), requestHash = digest(JSON.stringify({ kind, fingerprint }));
    return db.transaction(async tx => {
      // Serialize submissions of the same user/key, including across replicas.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId + keyHash}, 0))`);
      const [existing] = await tx.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.keyHash, keyHash))).limit(1);
      if (existing) {
        if (existing.requestHash !== requestHash) throw new AppError('This idempotency key was used for a different request', 409, 'IDEMPOTENCY_CONFLICT');
        return existing;
      }
      const backlog = await tx.execute(sql`SELECT count(*)::int AS count FROM request_jobs WHERE status IN ('queued','processing')`);
      if (Number(backlog.rows[0]?.count) >= 1000) throw new AppError('Processing queue is full. Please retry later.', 503, 'QUEUE_FULL');
      await admitUser(userId); // Fail closed; fallback models never bypass admission.
      const id = randomUUID();
      const job = { id, userId, kind };
      if (prepare) await prepare(tx);
      const [created] = await tx.insert(jobs).values({
        ...job, resourceId, keyHash, requestHash,
        payload: seal({ ...payload, idempotencyKey: key, userId }, aad(job)),
        priority: kind === 'chat' ? 0 : 1,
        estimatedMs: Math.min(600000, Math.max(1, Math.round(estimate))),
        events: [{ stage: 'queued', at: new Date().toISOString(), requestId: id, idempotencyKeyHash: keyHash }],
      }).returning();
      return created;
    });
  }

  static async get(id: string, userId: string) {
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).limit(1);
    if (!job) throw new NotFoundError('Request job');
    return { id: job.id, userId: job.userId, kind: job.kind, resourceId: job.resourceId,
      status: job.status, attempts: job.attempts, errorCode: job.errorCode,
      priority: job.priority, estimatedMs: job.estimatedMs,
      createdAt: job.createdAt, updatedAt: job.updatedAt,
      scheduling: 'priority-and-non-preemptive-estimated-SJF-with-aging',
      idempotencyKeyHash: job.keyHash, events: job.events,
      result: job.result ? unseal(job.result, aad(job)) : null };
  }

  static async enqueueChat(userId: string, sessionId: string, question: string, key: string) {
    await ChatService.getSession(sessionId, userId);
    return this.enqueue(userId, key, 'chat', sessionId, { sessionId, question },
      { sessionId, question }, 5000 + question.length * 10);
  }

  static async fence(tx: Transaction, id: string, owner: string) {
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.leaseOwner, owner))).for('update');
    if (!job || job.status !== 'processing') throw new AppError('Job ownership changed', 409, 'LEASE_LOST');
    return job;
  }

  static async complete(tx: Transaction, job: JobRow, owner: string, result: unknown) {
    await this.fence(tx, job.id, owner);
    await tx.update(jobs).set({ status: 'completed', result: seal(result, aad(job)),
      leaseOwner: null, leaseUntil: null, updatedAt: new Date(),
      events: [...job.events, { stage: 'committed', at: new Date().toISOString(), attempt: job.attempts }],
    }).where(eq(jobs.id, job.id));
  }

  static async workOnce(): Promise<boolean> {
    await pool.query(`WITH expired AS (
      UPDATE request_jobs SET status = 'failed', error_code = 'RETRY_EXHAUSTED', lease_owner = NULL,
        lease_until = NULL, events = events || jsonb_build_array(jsonb_build_object('stage','failed','code','RETRY_EXHAUSTED','at',now()))
      WHERE status = 'processing' AND lease_until < now() AND attempts >= 3 RETURNING resource_id, kind
    ) UPDATE documents SET status = 'failed', error_message = 'Interrupted processing; reindex to retry'
      WHERE id IN (SELECT resource_id FROM expired WHERE kind <> 'chat') AND status = 'processing'`);
    const owner = randomUUID();
    const claimed = await pool.query(`
      WITH candidate AS (
        SELECT j.id FROM request_jobs j
        WHERE (j.status = 'queued' OR (j.status = 'processing' AND j.lease_until < now()))
          AND j.attempts < 3
          AND NOT EXISTS (SELECT 1 FROM request_jobs busy WHERE busy.resource_id = j.resource_id
            AND busy.id <> j.id AND busy.status = 'processing' AND busy.lease_until >= now())
        ORDER BY CASE WHEN j.created_at < now() - interval '5 minutes' THEN 0 ELSE 1 END,
          CASE WHEN j.created_at < now() - interval '5 minutes' THEN 0 ELSE j.priority END,
          CASE WHEN j.created_at < now() - interval '5 minutes' THEN 0 ELSE j.estimated_ms END, j.created_at
        FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE request_jobs j SET status = 'processing', lease_owner = $1,
        lease_until = now() + interval '2 minutes', attempts = attempts + 1, updated_at = now(),
        events = events || jsonb_build_array(jsonb_build_object('stage','processing','at',now(),'attempt',attempts + 1))
      FROM candidate WHERE j.id = candidate.id RETURNING j.id`, [owner]);
    if (!claimed.rowCount) return false;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, claimed.rows[0].id));
    const heartbeat = setInterval(() => {
      pool.query("UPDATE request_jobs SET lease_until = now() + interval '2 minutes' WHERE id = $1 AND lease_owner = $2 AND status = 'processing'", [job.id, owner]).catch(() => {});
    }, 30000);
    try {
      const payload = unseal<Payload>(job.payload, aad(job));
      if (job.kind === 'chat') {
        await ChatService.sendMessage(job.resourceId, job.userId, payload.question!, {
          before: tx => this.fence(tx, job.id, owner).then(() => {}),
          after: (tx, result) => this.complete(tx, job, owner, result),
          requestId: job.id,
        });
      } else {
        const [doc] = await db.select().from(documents).where(and(eq(documents.id, job.resourceId), eq(documents.userId, job.userId)));
        if (!doc) throw new NotFoundError('Document');
        const file = path.resolve(env.UPLOAD_DIR, path.basename(doc.filePath.replace(/\\/g, '/')));
        if (await fileChecksum(file) !== payload.checksum) throw new AppError('Source file integrity check failed', 422, 'SOURCE_CHANGED');
        const result = await MLService.processDocument(doc.id, job.userId, file, doc.originalName, job.id);
        if (await fileChecksum(file) !== payload.checksum) throw new AppError('Source file integrity check failed', 422, 'SOURCE_CHANGED');
        await db.transaction(async tx => {
          await this.fence(tx, job.id, owner);
          await tx.update(documents).set({ status: 'ready', pageCount: result.pages_processed,
            analysis: result.analysis ?? null, errorMessage: null, updatedAt: new Date() }).where(eq(documents.id, doc.id));
          await this.complete(tx, job, owner, { documentId: doc.id, status: 'ready' });
        });
      }
      logger.info('Request job committed', { requestId: job.id, userIdHash: digest(job.userId), kind: job.kind, attempts: job.attempts });
    } catch (error) {
      const code = error instanceof AppError ? error.code || 'JOB_FAILED' : 'JOB_FAILED';
      // Bound retries and never expose remote exception text or decrypted payloads.
      await db.transaction(async tx => {
        await this.fence(tx, job.id, owner);
        await tx.update(jobs).set({ status: 'failed', errorCode: code, leaseOwner: null,
          leaseUntil: null, updatedAt: new Date(),
          events: [...job.events, { stage: 'failed', at: new Date().toISOString(), code }],
        }).where(eq(jobs.id, job.id));
        if (job.kind !== 'chat') await tx.update(documents).set({ status: 'failed', errorMessage: 'Queued processing failed. Reindex to retry.' }).where(eq(documents.id, job.resourceId));
      }).catch(() => {});
      logger.warn('Request job failed', { requestId: job.id, code });
    } finally { clearInterval(heartbeat); }
    return true;
  }

  static async start() {
    await (await getRedis()).ping();
    // Crash recovery after the final allowed attempt, without deleting source files.
    await pool.query("UPDATE request_jobs SET status = 'failed', error_code = 'RETRY_EXHAUSTED' WHERE status = 'processing' AND lease_until < now() AND attempts >= 3");
    for (let i = 0; i < env.QUEUE_CONCURRENCY; i++) {
      const loop = async () => {
        try { await this.workOnce(); } catch { logger.warn('Job worker coordination failed'); }
        setTimeout(loop, 500).unref();
      };
      void loop();
    }
  }
}
