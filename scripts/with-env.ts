#!/usr/bin/env node
/**
 * Environment-aware script wrapper
 *
 * Loads env file then executes the given command.
 *
 * Usage:
 *   tsx scripts/with-env.ts <command> [args...]
 *   NODE_ENV=production tsx scripts/with-env.ts <command> [args...]
 *   ENV_FILE=.env.production tsx scripts/with-env.ts <command> [args...]
 *
 * Priority: ENV_FILE > .env.{NODE_ENV} > .env.local > .env
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(filePath: string) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes (single or double)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  return true;
}

// Determine which env files to load
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = process.env.ENV_FILE;

const filesToTry = envFile
  ? [envFile]
  : [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env.local', '.env'];

let loaded = false;
for (const file of filesToTry) {
  const fullPath = resolve(file);
  if (loadEnv(fullPath)) {
    console.log(`📄 Loaded: ${file}`);
    loaded = true;
  }
}

if (!loaded) {
  console.log('⚠️  No env file found, using process environment');
}

// Get command
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ No command provided');
  process.exit(1);
}

const command = args.join(' ');
console.log(`▶️  ${command}\n`);

try {
  execSync(command, { stdio: 'inherit', cwd: process.cwd(), env: process.env });
} catch {
  process.exit(1);
}
