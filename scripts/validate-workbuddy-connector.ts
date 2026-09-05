#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkBuddyConnector } from '../src/mcp/workbuddy-package';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const result = await validateWorkBuddyConnector(repositoryRoot);
  console.log(
    `WorkBuddy Connector ${result.source}@${result.packageVersion} is structurally valid (${result.files.length} package files, MCP server: ${result.serverName}).`
  );
} catch (error) {
  console.error(
    `WorkBuddy Connector validation failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
