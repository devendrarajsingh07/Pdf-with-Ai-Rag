import { eq, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { chatSessions, documents } from '../models';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import { MLService } from './ml.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { JobService, fileChecksum, validateIdempotencyKey } from './job.service';
import { randomUUID } from 'crypto';

export class DocumentService {
  static resolveFilePath(filePath: string) {
    // Historical records can contain relative paths or Windows separators.
    return path.resolve(env.UPLOAD_DIR, path.basename(filePath.replace(/\\/g, '/')));
  }

  static async getUserDocuments(userId: string) {
    return await db.select().from(documents).where(eq(documents.userId, userId));
  }

  static async getDocument(id: string, userId: string) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    
    if (!doc) throw new NotFoundError('Document');
    if (doc.userId !== userId) throw new ForbiddenError('You do not own this document');
    
    return doc;
  }

  static async createDocument(userId: string, file: Express.Multer.File, key?: string) {
    if (env.QUEUE_ENABLED) {
      const id = randomUUID(), checksum = await fileChecksum(file.path);
      const job = await JobService.enqueue(userId, validateIdempotencyKey(key), 'document', id,
        { filePath: file.path, originalName: file.originalname, checksum },
        { checksum, originalName: file.originalname }, file.size / 30,
        async tx => { await tx.insert(documents).values({ id, userId, name: file.filename,
          originalName: file.originalname, filePath: file.path, fileSize: file.size,
          mimeType: file.mimetype, status: 'processing' }); });
      return this.getDocument(job.resourceId, userId);
    }
    const [doc] = await db.insert(documents).values({
      userId,
      name: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: 'processing',
    }).returning();

    // Trigger async processing — fire and forget, update status on completion
    MLService.processDocument(doc.id, userId, this.resolveFilePath(file.path), doc.originalName)
      .then(async (result) => {
        await db.update(documents)
          .set({
            status: 'ready',
            pageCount: result.pages_processed ?? null,
            analysis: result.analysis ?? null,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id));
        logger.info(`Document ${doc.id} processed: ${result.chunks_created} chunks`);
      })
      .catch(async (error) => {
        logger.error('Failed to process document async', { error, docId: doc.id });
        await DocumentService.updateStatus(doc.id, 'failed', error.message);
      })
      .catch(error => {
        logger.error('Failed to persist processing status', { error, docId: doc.id });
      });

    return doc;
  }

  static async updateStatus(id: string, status: string, errorMessage?: string) {
    await db.update(documents)
      .set({ status, errorMessage, updatedAt: new Date() })
      .where(eq(documents.id, id));
  }

  static async deleteDocument(id: string, userId: string) {
    const doc = await this.getDocument(id, userId);

    try {
      await MLService.deleteDocument(id, userId);
    } catch (err) {
      logger.warn('Failed to delete from ML service, continuing local deletion', { err, id });
    }

    const resolvedFilePath = this.resolveFilePath(doc.filePath);
    await fs.promises.unlink(resolvedFilePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });

    await db.transaction(async (tx) => {
      await tx.update(chatSessions)
        .set({
          documentIds: sql`array_remove(${chatSessions.documentIds}, ${id})`,
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.userId, userId));
      await tx.delete(documents).where(eq(documents.id, id));
    });
    return { success: true };
  }

  static async reindexDocument(id: string, userId: string, key?: string) {
    const doc = await this.getDocument(id, userId);
    if (env.QUEUE_ENABLED) {
      const filePath = this.resolveFilePath(doc.filePath), checksum = await fileChecksum(filePath);
      const job = await JobService.enqueue(userId, validateIdempotencyKey(key), 'reindex', id,
        { filePath, checksum, originalName: doc.originalName }, { id, checksum }, doc.fileSize / 30,
        async tx => { await tx.update(documents).set({ status: 'processing', errorMessage: null }).where(eq(documents.id, id)); });
      return { success: true, message: 'Reindexing queued', jobId: job.id };
    }
    
    await this.updateStatus(id, 'processing');
    
    MLService.reindexDocument(id, userId, this.resolveFilePath(doc.filePath), doc.originalName)
      .then(async (result) => {
        await db.update(documents)
          .set({
            status: 'ready',
            pageCount: result.pages_processed ?? null,
            analysis: result.analysis ?? null,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, id));
        logger.info(`Document ${id} reindexed: ${result.chunks_created} chunks`);
      })
      .catch(async (error) => {
        logger.error('Failed to reindex document async', { error, docId: id });
        await DocumentService.updateStatus(id, 'failed', error.message);
      })
      .catch(error => {
        logger.error('Failed to persist reindex status', { error, docId: id });
      });
    
    return { success: true, message: 'Reindexing started' };
  }
}
