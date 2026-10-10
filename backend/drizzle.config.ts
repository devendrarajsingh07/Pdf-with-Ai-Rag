import type { Config } from 'drizzle-kit';

export default {
  schema: './src/models/*',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
} satisfies Config;
