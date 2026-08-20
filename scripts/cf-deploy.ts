#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function loadEnvFile(filePath: string) {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) return false;

  for (const line of readFileSync(fullPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!ENV_NAME.test(key) || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

const loaded = loadEnvFile('.env.production') || loadEnvFile('.env.local');
if (loaded) console.log('Loaded deployment environment file.');

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('pnpm', ['cf:build']);
run('pnpm', ['exec', 'wrangler', 'deploy']);
