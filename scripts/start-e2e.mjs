import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'beatdesign-e2e-'));
const env = { ...process.env, BEATDESIGN_DATA_DIR: directory, BEATDESIGN_MCP_HTTP_PORT: '3043', BEATDESIGN_MCP_TOKEN: 'e2e-local-only' };
execFileSync('pnpm', ['db:push'], { env, stdio: 'inherit' });
const children = [
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3042', '--strictPort'], { env, stdio: 'inherit' }),
  spawn(process.execPath, ['--import', 'tsx', 'scripts/mcp-server.ts', '--http'], { env, stdio: 'inherit' }),
];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
};
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, stop);
for (const child of children) child.once('exit', stop);
await Promise.all(children.map((child) => new Promise((resolve) => child.once('exit', resolve))));
await rm(directory, { recursive: true, force: true });
