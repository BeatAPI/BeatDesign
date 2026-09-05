#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { BEATDESIGN_MCP_TOOL_NAMES } from '../src/mcp/tools';

const repositoryRoot = resolve(import.meta.dirname, '..');
const rootPackage = JSON.parse(
  await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
) as { version: string };
const tarball = resolve(
  repositoryRoot,
  process.argv[2] ??
    `dist/beatapi-beatdesign-workbuddy-${rootPackage.version}.tgz`
);
const probeRoot = await mkdtemp(join(tmpdir(), 'beatdesign-workbuddy-probe-'));
const dataDirectory = resolve(probeRoot, 'data');
let runtime: ReturnType<typeof spawn> | undefined;
let stderr = '';

const run = async (command: string, args: string[]) => {
  const child = spawn(command, args, {
    cwd: probeRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk.toString('utf8')));
  child.stderr?.on('data', (chunk) => (output += chunk.toString('utf8')));
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolveExit(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${output}`);
  }
};

const send = (message: Record<string, unknown>) => {
  runtime?.stdin?.write(`${JSON.stringify(message)}\n`);
};

const readJsonLine = async (timeoutMs = 45_000) =>
  new Promise<Record<string, unknown>>((resolveLine, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for packaged MCP runtime.\n${stderr.slice(-4_000)}`
        )
      );
    }, timeoutMs);
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      runtime?.stdout?.off('data', onData);
      clearTimeout(timer);
      try {
        resolveLine(JSON.parse(buffer.slice(0, newline)) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    };
    runtime?.stdout?.on('data', onData);
  });

try {
  await access(tarball);
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await run(npmCommand, [
    'install',
    '--no-audit',
    '--no-fund',
    '--prefix',
    probeRoot,
    tarball,
  ]);

  const launcher = resolve(
    probeRoot,
    'node_modules',
    '@beatapi',
    'beatdesign-workbuddy',
    'bin',
    'beatdesign-workbuddy.mjs'
  );
  runtime = spawn(process.execPath, [launcher], {
    cwd: probeRoot,
    env: {
      ...process.env,
      BEATDESIGN_DATA_DIR: dataDirectory,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  runtime.stderr?.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'workbuddy-package-probe', version: '1.0.0' },
    },
  });
  const initialized = await readJsonLine();
  const serverInfo = (
    initialized.result as {
      serverInfo?: { name?: string; version?: string };
    }
  ).serverInfo;
  assert.equal(serverInfo?.name, 'beatdesign');
  assert.equal(serverInfo?.version, rootPackage.version);

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const listed = await readJsonLine(15_000);
  const tools = (
    listed.result as { tools?: Array<{ name: string }> }
  ).tools?.map((tool) => tool.name);
  assert.deepEqual(tools, [...BEATDESIGN_MCP_TOOL_NAMES]);

  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'bdesign_project_list', arguments: { limit: 5 } },
  });
  const projectList = await readJsonLine(15_000);
  const payload = projectList.result as {
    structuredContent?: { result?: unknown };
  };
  assert.ok(Array.isArray(payload.structuredContent?.result));

  const health = await fetch('http://127.0.0.1:3020/api/ping');
  assert.equal(health.ok, true);
  assert.equal((await health.json()).message, 'pong');

  const conflictingRuntime = spawn(process.execPath, [launcher], {
    cwd: probeRoot,
    env: {
      ...process.env,
      BEATDESIGN_DATA_DIR: resolve(probeRoot, 'conflicting-data'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let conflictError = '';
  conflictingRuntime.stderr?.on('data', (chunk) => {
    conflictError += chunk.toString('utf8');
  });
  const conflictExitCode = await new Promise<number>((resolveExit, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Conflicting runtime did not stop promptly')),
      10_000
    );
    conflictingRuntime.once('exit', (code) => {
      clearTimeout(timer);
      resolveExit(code ?? 1);
    });
  });
  assert.equal(conflictExitCode, 1);
  assert.match(conflictError, /Port 3020 is already serving another BeatDesign/);

  await access(resolve(dataDirectory, 'local.db'));
  await assert.rejects(
    access(
      resolve(
        probeRoot,
        'node_modules',
        '@beatapi',
        'beatdesign-workbuddy',
        'data',
        'local.db'
      )
    )
  );

  console.log(
    `Packaged WorkBuddy runtime passed: BeatDesign ${rootPackage.version}, ${tools?.length ?? 0} MCP tools, isolated local data.`
  );
} finally {
  if (runtime && runtime.exitCode === null) {
    runtime.kill('SIGTERM');
    await new Promise((resolveExit) => {
      const timer = setTimeout(resolveExit, 5_000);
      runtime?.once('exit', () => {
        clearTimeout(timer);
        resolveExit(undefined);
      });
    });
  }
  await rm(probeRoot, { recursive: true, force: true });
}
