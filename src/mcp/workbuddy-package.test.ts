import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import {
  createWorkBuddyConnectorArchive,
  validateWorkBuddyConnector,
  WORKBUDDY_CONNECTOR_DIRECTORY,
  WORKBUDDY_CONNECTOR_FILES,
} from './workbuddy-package';

test('WorkBuddy Connector passes submission-package validation', async () => {
  const result = await validateWorkBuddyConnector();

  assert.equal(result.serverName, 'beatdesign');
  assert.equal(result.source, 'beatapi-beatdesign');
  assert.deepEqual(result.files, WORKBUDDY_CONNECTOR_FILES);
});

test('WorkBuddy archive contains only the files accepted for submission', async () => {
  const { archive } = await createWorkBuddyConnectorArchive();
  const zip = await JSZip.loadAsync(archive);
  const files = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(files, [...WORKBUDDY_CONNECTOR_FILES].sort());

  for (const relativePath of WORKBUDDY_CONNECTOR_FILES) {
    const archived = await zip.file(relativePath)?.async('nodebuffer');
    const source = await readFile(
      resolve(WORKBUDDY_CONNECTOR_DIRECTORY, relativePath)
    );
    assert.deepEqual(archived, source, `${relativePath} must be copied exactly`);
  }
});
