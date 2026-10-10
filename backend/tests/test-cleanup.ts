import { pool } from '../src/config/database';

afterAll(async () => {
  await pool.end();
});
