import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildLocalProjectAssetUrl,
  persistLocalProjectAsset,
  resolveLocalProjectAssetPath,
  sanitizeLocalProjectAssetFilename,
} from './local-project-assets';

test('persists imported media inside an immutable project-owned local directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'beatapi-project-assets-'));
  try {
    const result = await persistLocalProjectAsset({
      projectId: 'project-1',
      assetId: 'asset-1',
      filename: '../角色 图.png',
      mimeType: 'image/png',
      bytes: new TextEncoder().encode('image-bytes'),
      assetRoot: root,
    });

    assert.equal(result.filename, '角色-图.png');
    assert.equal(result.objectKey, 'project-1/asset-1/角色-图.png');
    assert.equal(
      result.publicUrl,
      '/api/app/projects/project-1/assets/asset-1'
    );
    assert.equal(await readFile(result.filePath, 'utf8'), 'image-bytes');
    assert.equal(result.sizeBytes, 11);
    assert.equal(result.sha256.length, 64);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects traversal and unsafe project path segments', () => {
  assert.throws(
    () =>
      resolveLocalProjectAssetPath({
        objectKey: '../../outside.png',
        assetRoot: '/tmp/beatapi-assets',
      }),
    /Invalid local project asset path/
  );
  assert.equal(
    sanitizeLocalProjectAssetFilename({
      filename: '.hidden',
      mimeType: 'video/mp4',
    }),
    'hidden.mp4'
  );
  assert.equal(
    buildLocalProjectAssetUrl({ projectId: '项目 1', assetId: 'asset/1' }),
    '/api/app/projects/%E9%A1%B9%E7%9B%AE%201/assets/asset%2F1'
  );
});
