import { desc, eq } from 'drizzle-orm';
import { db } from '../config/database';
import { chatSessions, messages, documents } from '../models';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import { MLService } from './ml.service';

export class ChatService {
  private static normalizeCitations(citations: unknown) {
    if (!Array.isArray(citations)) return [];

    return citations.map((citation: any) => ({
      documentId: citation.document_id ?? citation.documentId ?? '',
      documentName: citation.document_name ?? citation.documentName ?? '',
      pageNumber: citation.page_number ?? citation.pageNumber ?? 0,
      chunkId: citation.chunk_id ?? citation.chunkId ?? '',
      excerpt: citation.excerpt ?? '',
      relevanceScore: citation.relevance_score ?? citation.relevanceScore ?? null,
    }));
  }

  static async createSession(userId: string, title: string | undefined, documentIds: string[]) {
    // Validate documents
    for (const docId of documentIds) {
      const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
      if (!doc) throw new NotFoundError(`Document ${docId}`);
      if (doc.userId !== userId) throw new ForbiddenError(`You do not own document ${docId}`);
      if (doc.status !== 'ready') throw new AppError(`Document ${docId} is not ready for chat`, 400);
    }

    const sessionTitle = title || `Chat ${new Date().toLocaleString()}`;

    const [session] = await db.insert(chatSessions).values({
      userId,
      title: sessionTitle,
      documentIds,
    }).returning();

    return session;
  }

  static async getUserSessions(userId: string) {
    return await db.select().from(chatSessions).where(eq(chatSessions.userId, userId));
  }

  static async getSession(id: string, userId: string) {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
    if (!session) throw new NotFoundError('Chat session');
    if (session.userId !== userId) throw new ForbiddenError('You do not own this session');
    return session;
  }

  static async deleteSession(id: string, userId: string) {
    await this.getSession(id, userId); // verify ownership
    
    await db.delete(messages).where(eq(messages.sessionId, id));
    await db.delete(chatSessions).where(eq(chatSessions.id, id));
    
    return { success: true };
  }

  static async getMessages(sessionId: string, userId: string) {
    await this.getSession(sessionId, userId); // verify ownership
    return await db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(messages.createdAt);
  }

  static async sendMessage(sessionId: string, userId: string, question: string, job?: {
    before: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>;
    after: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], result: unknown) => Promise<void>;
    requestId: string;
  }) {
    const session = await this.getSession(sessionId, userId);
    if (!session.documentIds.length) {
      throw new AppError('This chat has no documents. Start a new chat with a ready document.', 400, 'NO_DOCUMENTS');
    }

    const recentMessages = await db.select({
      role: messages.role,
      content: messages.content,
    })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.createdAt))
      .limit(4);
    const conversationHistory = recentMessages.reverse();

    // Keep the remote call outside the transaction. Persist the exchange atomically.
    const mlResponse = await MLService.chat(
        userId,
        sessionId,
        question,
        session.documentIds as string[],
        conversationHistory,
        job?.requestId,
    );

    return db.transaction(async tx => {
      if (job) await job.before(tx);
      const [userMsg] = await tx.insert(messages).values({
        sessionId, role: 'user', content: question,
      }).returning();
      const [assistantMsg] = await tx.insert(messages).values({
        sessionId, role: 'assistant', content: mlResponse.answer,
        citations: this.normalizeCitations(mlResponse.citations),
      }).returning();
      const result = { userMessage: userMsg, assistantMessage: assistantMsg };
      if (job) await job.after(tx, result);
      return result;
    });
  }
}
