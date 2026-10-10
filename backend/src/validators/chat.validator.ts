import { z } from 'zod';

export const createSessionSchema = z.object({
  body: z.object({
    title: z.string().max(200).optional(),
    documentIds: z.array(z.string().uuid('Invalid document ID')).min(1, 'At least one document is required').max(20),
  }),
});

export const messageSchema = z.object({
  body: z.object({
    question: z.string().trim().min(1, 'Question cannot be empty').max(8000),
  }),
  params: z.object({
    id: z.string().uuid('Invalid session ID'),
  }),
});

export const sessionParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid session ID'),
  }),
});
