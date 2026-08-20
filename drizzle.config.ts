import { defineConfig } from 'drizzle-kit';
import { loadEnvFiles } from './src/lib/env';

loadEnvFiles();

const provider = process.env.DATABASE_PROVIDER || 'sqlite';

if (provider !== 'sqlite' && provider !== 'd1') {
  throw new Error('BeatAPI Workspace supports DATABASE_PROVIDER=sqlite or d1');
}

export default defineConfig({
  schema: './src/config/db/schema.ts',
  out: './drizzle/d1',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:data/local.db',
  },
});
