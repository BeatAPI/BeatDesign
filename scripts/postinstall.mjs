// Keep fresh-clone setup compatible with Node.js on Windows, macOS and Linux.
import { existsSync, mkdirSync } from 'node:fs';

mkdirSync('data', { recursive: true });
if (!existsSync('src/config/db/schema.ts')) {
  await import('./db-setup.mjs');
}
