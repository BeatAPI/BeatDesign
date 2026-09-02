import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';

// MCP hosts spawn the server from arbitrary working directories. The entry
// script must survive that: tsx locates tsconfig.json (the @/* aliases) and
// the app resolves data/ paths from the process working directory, so a
// foreign cwd previously crashed the server with ERR_MODULE_NOT_FOUND or
// created a stray data/local.db. This test launches the entry from the OS
// temp directory with absolute paths and no BeatDesign-related environment,
// mirroring how a GUI host without cwd support would spawn it. TSX's own
// TSX_TSCONFIG_PATH override is intentionally not set here: it is consumed
// before this entry script can run and is not a supported host setting.
const send = (
  child: ReturnType<typeof spawn>,
  message: Record<string, unknown>
) => {
  child.stdin?.write(`${JSON.stringify(message)}\n`);
};

const readJsonLine = async (
  child: ReturnType<typeof spawn>,
  timeoutMs = 20_000
) =>
  new Promise<Record<string, unknown>>((resolveLine, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for MCP stdio response'));
    }, timeoutMs);
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      child.stdout?.off('data', onData);
      clearTimeout(timer);
      resolveLine(JSON.parse(buffer.slice(0, newline)) as Record<string, unknown>);
    };
    child.stdout?.on('data', onData);
  });

test('MCP server starts and answers when spawned from a foreign working directory', async () => {
  const repositoryRoot = resolve('.');
  const foreignRoot = mkdtempSync(join(tmpdir(), 'beatdesign-cwd-'));
  const env = { ...process.env };
  delete env.TSX_TSCONFIG_PATH;
  const child = spawn(
    resolve(repositoryRoot, 'node_modules/.bin/tsx'),
    [resolve(repositoryRoot, 'scripts/mcp-server.ts')],
    {
      cwd: foreignRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  try {
    send(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'beatdesign-cwd-probe', version: '0.0.1' },
      },
    });
    const initialized = await readJsonLine(child);
    const initResult = initialized.result as {
      serverInfo?: { name?: string };
    };
    assert.equal(initResult.serverInfo?.name, 'beatdesign');

    send(child, { jsonrpc: '2.0', method: 'notifications/initialized' });
    send(child, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const listed = await readJsonLine(child);
    const tools = (
      listed.result as { tools?: Array<{ name: string }> }
    ).tools?.map((tool) => tool.name);
    assert.deepEqual(tools, [...BEATDESIGN_MCP_TOOL_NAMES]);

    assert.equal(
      existsSync(join(foreignRoot, 'data', 'local.db')),
      false,
      'foreign cwd must not receive a second SQLite database'
    );

    const exited = new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolveExit, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for MCP server shutdown')),
        5_000
      );
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        resolveExit({ code, signal });
      });
    });
    child.kill('SIGTERM');
    const exitResult = await exited;
    assert.equal(exitResult.signal, null);
    assert.equal(exitResult.code, 143);
  } finally {
    if (!child.killed) child.kill();
    rmSync(foreignRoot, { recursive: true, force: true });
  }
});
