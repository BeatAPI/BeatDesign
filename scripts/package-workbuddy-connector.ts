#!/usr/bin/env node
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkBuddyConnectorArchive } from '../src/mcp/workbuddy-package';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readOutputArgument = () => {
  const index = process.argv.indexOf('--output');
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--output requires a file path');
  }
  return value;
};

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

try {
  const { archive, validation } =
    await createWorkBuddyConnectorArchive(repositoryRoot);
  const requestedOutput = readOutputArgument();
  const defaultOutput = resolve(
    repositoryRoot,
    'dist',
    `beatdesign-workbuddy-connector-v${validation.packageVersion}.zip`
  );
  const outputPath = requestedOutput
    ? isAbsolute(requestedOutput)
      ? requestedOutput
      : resolve(process.cwd(), requestedOutput)
    : defaultOutput;

  if (await pathExists(outputPath)) {
    throw new Error(
      `Refusing to overwrite existing package: ${outputPath}. Remove it or choose another --output path.`
    );
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archive);
  console.log(
    `Created WorkBuddy Connector ${validation.source}@${validation.packageVersion}: ${outputPath}`
  );
} catch (error) {
  console.error(
    `WorkBuddy Connector packaging failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
