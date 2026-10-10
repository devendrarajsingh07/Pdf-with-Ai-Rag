import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Backend tests require DATABASE_URL to be set to an isolated test database');
}

let databaseName = '';
try {
  databaseName = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
} catch {
  throw new Error('Backend tests require a valid DATABASE_URL');
}

if (!databaseName.includes('test')) {
  throw new Error(
    `Refusing to run backend tests against database "${databaseName}"; the database name must contain "test"`
  );
}

// All upload writes/deletions in tests belong to a fresh temporary directory.
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'documind-jest-uploads-'));
