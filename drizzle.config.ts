import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/config/db/schema.ts',
  out: './drizzle/sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:data/local.db',
  },
});
