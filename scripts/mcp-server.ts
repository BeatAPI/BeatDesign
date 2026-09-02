#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// The SQLite database, the data/project-assets store, and tsx's tsconfig.json
// discovery (which provides the @/* path aliases) all resolve relative to the
// process working directory. tsx picks its tsconfig at process start, before
// any script code runs, so an MCP host that spawns this entry from another
// directory would fail with ERR_MODULE_NOT_FOUND and could even create a
// stray data/local.db there. When the working directory is not the repository
// root, restart through the local tsx binary with the correct cwd; hosts that
// already spawn from the repository root take the direct path below.
const repositoryRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const tsxCli = resolve(
  repositoryRoot,
  'node_modules',
  'tsx',
  'dist',
  'cli.mjs'
);
const scriptPath = fileURLToPath(import.meta.url);

function isRepositoryCwd() {
  try {
    return realpathSync(process.cwd()) === realpathSync(repositoryRoot);
  } catch {
    return process.cwd() === repositoryRoot;
  }
}

const signalExitCodes = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
} as const;

async function main() {
  if (!isRepositoryCwd()) {
    // Use the exact Node executable that already launched this process. This
    // avoids PATH-dependent node_modules/.bin wrappers and works on Windows
    // without spawning a .cmd file through a shell.
    const childEnv = { ...process.env };
    // A host can set this for its own project; inheriting it would override
    // tsx's repository-root config discovery in the restarted process.
    delete childEnv.TSX_TSCONFIG_PATH;
    const child = spawn(process.execPath, [tsxCli, scriptPath, ...process.argv.slice(2)], {
      cwd: repositoryRoot,
      stdio: 'inherit',
      env: childEnv,
    });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      process.on(signal, () => child.kill(signal));
    }
    child.on('error', (error) => {
      console.error(
        `[BeatDesign MCP] Could not restart from the repository root (${repositoryRoot}): ${error.message}. Run pnpm install inside the repository first.`
      );
      process.exit(1);
    });
    child.on('exit', (code, signal) => {
      process.exit(
        code ?? signalExitCodes[signal as keyof typeof signalExitCodes] ?? 1
      );
    });
    return;
  }

  if (process.argv.includes('--http')) {
    const { startBeatDesignMcpHttpServer } = await import('../src/mcp/http-server');
    await startBeatDesignMcpHttpServer();
    return;
  }

  const { startBeatDesignMcpServer } = await import('../src/mcp/server');
  startBeatDesignMcpServer();
  console.error('BeatDesign MCP server is running on stdio.');
}

void main();
