import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

test('API routes do not return raw exception messages to clients', async () => {
  const apiRoot = new URL('../routes/api/', import.meta.url);
  const entries = await readdir(apiRoot, { recursive: true });
  const routeFiles = entries.filter((entry) => /\.tsx?$/.test(entry));

  for (const routeFile of routeFiles) {
    const source = await readFile(new URL(routeFile, apiRoot), 'utf8');
    assert.doesNotMatch(
      source,
      /respErr\((?:error|err|e)(?:\?\.|\.)message/,
      `${routeFile} must log internal errors but return fixed public copy`
    );
  }
});
