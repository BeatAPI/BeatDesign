import { defineConfig } from 'drizzle-kit';
import { resolve } from 'node:path';

export default defineConfig({
  schema: './src/config/db/schema.ts',
  out: './drizzle/sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.BEATDESIGN_DATA_DIR?.trim()
      ? `file:${resolve(process.env.BEATDESIGN_DATA_DIR, 'local.db')}`
      : 'file:data/local.db',
  },
});
