import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { chatSessions } from './chat.model';

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id).notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  citations: jsonb('citations'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
