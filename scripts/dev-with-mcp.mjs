#!/usr/bin/env node
import { spawn } from 'node:child_process';

const packageManagerCli = process.env.npm_execpath;

if (!packageManagerCli) {
  console.error('Run this command through pnpm: pnpm dev:agent');
  process.exit(1);
}

const hasRunningWorkspace = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);
  try {
    const response = await fetch('http://127.0.0.1:3020/api/ping', {
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.message === 'pong';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const workspaceAlreadyRunning = await hasRunningWorkspace();
if (workspaceAlreadyRunning) {
  console.error(
    'BeatDesign is already running at http://127.0.0.1:3020; starting MCP only.'
  );
}

const commands = workspaceAlreadyRunning ? ['mcp:http'] : ['dev', 'mcp:http'];
const children = commands.map((command) =>
  spawn(process.execPath, [packageManagerCli, 'run', command], {
    stdio: 'inherit',
    env: process.env,
  })
);

let stopping = false;

const stopAll = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => stopAll(signal));
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(`BeatDesign Agent runtime failed to start: ${error.message}`);
    stopAll();
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (code !== 0 || signal) {
      console.error(
        `A BeatDesign Agent process stopped unexpectedly (${signal ?? `exit ${code}`}).`
      );
    }
    process.exitCode = code ?? 1;
    stopAll();
  });
}

await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.once('exit', resolve);
      })
  )
);
