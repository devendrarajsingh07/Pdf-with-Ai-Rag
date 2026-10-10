import { pgTable, uuid, text, integer, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './user.model';
import { sql } from 'drizzle-orm';

export const jobs = pgTable('request_jobs', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  keyHash: text('key_hash').notNull(),
  requestHash: text('request_hash').notNull(),
  kind: text('kind').notNull(),
  resourceId: uuid('resource_id').notNull(),
  payload: text('encrypted_payload').notNull(),
  result: text('encrypted_result'),
  status: text('status').notNull().default('queued'),
  priority: integer('priority').notNull(),
  estimatedMs: integer('estimated_ms').notNull(),
  attempts: integer('attempts').notNull().default(0),
  leaseOwner: text('lease_owner'),
  leaseUntil: timestamp('lease_until'),
  errorCode: text('error_code'),
  events: jsonb('events').$type<Record<string, unknown>[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, table => ({ idempotency: uniqueIndex('request_jobs_user_key_unique').on(table.userId, table.keyHash),
  activeResource: uniqueIndex('request_jobs_active_resource_unique').on(table.resourceId).where(sql`${table.status} = 'processing'`),
}));
