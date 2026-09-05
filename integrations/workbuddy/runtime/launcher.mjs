#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceUrl = 'http://127.0.0.1:3020';

const defaultDataDirectory = () => {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'BeatDesign');
  }
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || homedir(), 'BeatDesign');
  }
  return join(
    process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'),
    'beatdesign'
  );
};

const dataDirectory = resolve(
  process.env.BEATDESIGN_DATA_DIR?.trim() || defaultDataDirectory()
);
const runtimeEnv = {
  ...process.env,
  BEATDESIGN_DATA_DIR: dataDirectory,
};

const migrateDatabase = async () => {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const client = createClient({
    url: `file:${resolve(dataDirectory, 'local.db')}`,
  });
  try {
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS __beatdesign_runtime_migrations (
        name TEXT PRIMARY KEY NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `);
    const appliedResult = await client.execute(
      'SELECT name FROM __beatdesign_runtime_migrations'
    );
    const applied = new Set(
      appliedResult.rows.map((row) => String(row.name))
    );
    const migrationsDirectory = resolve(packageRoot, 'drizzle', 'sqlite');
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort();

    for (const name of migrationFiles) {
      if (applied.has(name)) continue;
      const source = await readFile(resolve(migrationsDirectory, name), 'utf8');
      const sql = source.replaceAll('--> statement-breakpoint', '');
      await client.executeMultiple(sql);
      await client.execute({
        sql: 'INSERT INTO __beatdesign_runtime_migrations (name, applied_at) VALUES (?, ?)',
        args: [name, Date.now()],
      });
    }
  } finally {
    client.close();
  }
};

const isWorkspaceHealthy = async () => {
  try {
    const response = await fetch(`${workspaceUrl}/api/ping`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.message === 'pong';
  } catch {
    return false;
  }
};

const waitForWorkspace = async (child, getStartError) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const startError = getStartError();
    if (startError) {
      throw new Error(`BeatDesign workspace could not start: ${startError.message}`);
    }
    if (child.exitCode !== null) {
      throw new Error(
        `BeatDesign workspace stopped during startup (exit ${child.exitCode}).`
      );
    }
    if (await isWorkspaceHealthy()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`BeatDesign workspace did not become ready at ${workspaceUrl}.`);
};

const pipeToStderr = (stream, prefix) => {
  stream?.on('data', (chunk) => {
    process.stderr.write(`[${prefix}] ${chunk}`);
  });
};

let workspaceProcess;
let mcpProcess;
let stopping = false;

const stopAll = (signal = 'SIGTERM') => {
  if (stopping) return;
  stopping = true;
  if (mcpProcess && !mcpProcess.killed) mcpProcess.kill(signal);
  if (workspaceProcess && !workspaceProcess.killed) {
    workspaceProcess.kill(signal);
  }
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => stopAll(signal));
}

try {
  if (await isWorkspaceHealthy()) {
    throw new Error(
      'Port 3020 is already serving another BeatDesign workspace. Stop that workspace, then reconnect the WorkBuddy Connector.'
    );
  }
  await migrateDatabase();

  const serverEntry = resolve(
    packageRoot,
    'app',
    '.output',
    'server',
    'index.mjs'
  );
  let workspaceStartError;
  workspaceProcess = spawn(process.execPath, [serverEntry], {
    cwd: packageRoot,
    env: {
      ...runtimeEnv,
      HOST: '127.0.0.1',
      PORT: '3020',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  workspaceProcess.once('error', (error) => {
    workspaceStartError = error;
  });
  pipeToStderr(workspaceProcess.stdout, 'BeatDesign workspace');
  pipeToStderr(workspaceProcess.stderr, 'BeatDesign workspace');
  await waitForWorkspace(workspaceProcess, () => workspaceStartError);

  const mcpEntry = resolve(packageRoot, 'mcp', 'server.mjs');
  mcpProcess = spawn(process.execPath, [mcpEntry], {
    cwd: packageRoot,
    env: runtimeEnv,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  mcpProcess.on('error', (error) => {
    console.error(`[BeatDesign MCP] ${error.message}`);
    stopAll();
  });

  const exitCode = await new Promise((resolvePromise) => {
    mcpProcess.once('exit', (code, signal) => {
      resolvePromise(code ?? (signal ? 1 : 0));
    });
  });
  stopAll();
  process.exitCode = exitCode;
} catch (error) {
  console.error(
    `[BeatDesign WorkBuddy] ${error instanceof Error ? error.message : String(error)}`
  );
  stopAll();
  process.exitCode = 1;
}
