import { z } from 'zod';

export const documentParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid document ID'),
  }),
});
