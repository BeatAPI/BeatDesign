import assert from 'node:assert/strict';
import test from 'node:test';

import { parseLocalProjectAssetUrl } from './local-project-asset-url';

test('parses durable local project asset ids from relative and absolute urls', () => {
  assert.deepEqual(
    parseLocalProjectAssetUrl('/api/app/projects/project-1/assets/asset-2'),
    { projectId: 'project-1', assetId: 'asset-2' }
  );
  assert.deepEqual(
    parseLocalProjectAssetUrl(
      'http://127.0.0.1:3020/api/app/projects/project-1/assets/asset-2'
    ),
    { projectId: 'project-1', assetId: 'asset-2' }
  );
});
test('does not invent asset ids for provider urls', () => {
  assert.equal(parseLocalProjectAssetUrl('https://cdn.example.com/video.mp4'), null);
});
