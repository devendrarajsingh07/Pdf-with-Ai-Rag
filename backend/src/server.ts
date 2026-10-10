import app from './app';
import { env } from './config/env';
import fs from 'fs';
import { pool } from './config/database';
import { db } from './config/database';
import { documents } from './models';
import { eq } from 'drizzle-orm';
import { JobService } from './services/job.service';

async function startServer() {
  if (!fs.existsSync(env.UPLOAD_DIR)) {
    fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  }

  try {
    await pool.query('SELECT 1');
    if (!env.QUEUE_ENABLED) await db.update(documents)
      .set({
        status: 'failed',
        errorMessage: 'Interrupted by restart',
        updatedAt: new Date(),
      })
      .where(eq(documents.status, 'processing'));
    if (env.QUEUE_ENABLED) await JobService.start();
    console.log('Database connected successfully');
    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to connect to database', error);
    process.exit(1);
  }
}

startServer();
