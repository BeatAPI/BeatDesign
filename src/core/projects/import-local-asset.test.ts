import assert from 'node:assert/strict';
import test from 'node:test';

import { importLocalProjectAsset } from './import-local-asset';

test('asset import rejects a relative file path', async () => {
  await assert.rejects(
    () =>
      importLocalProjectAsset({
        projectId: 'project-1',
        filePath: 'clip.mp4',
      }),
    /absolute file path/i
  );
});

test('asset import rejects a missing file path', async () => {
  await assert.rejects(
    () =>
      importLocalProjectAsset({
        projectId: 'project-1',
        filePath: '/tmp/beatdesign-missing-asset-file.mp4',
      }),
    /not found/i
  );
});
