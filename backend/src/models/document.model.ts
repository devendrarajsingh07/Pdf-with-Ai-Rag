import { pgTable, text, integer, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { users } from './user.model';

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  originalName: text('original_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'processing' | 'ready' | 'failed'
  pageCount: integer('page_count'),
  analysis: jsonb('analysis').$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),
  mlDocumentId: text('ml_document_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
