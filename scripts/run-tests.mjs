import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  ...globSync('src/**/*.test.ts', { cwd: root }),
  ...globSync('src/**/*.test.tsx', { cwd: root }),
]
  .sort()
  .map((file) => join(root, file));

if (files.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...files],
  {
    cwd: root,
    stdio: 'inherit',
  }
);

process.exit(result.status ?? 1);
