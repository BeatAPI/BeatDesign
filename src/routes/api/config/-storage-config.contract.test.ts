import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const configSource = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
const uploadSource = readFileSync(
  new URL('../storage/upload.ts', import.meta.url),
  'utf8'
);

test('storage configuration keeps BeatAPI default and local custom R2/S3 settings', () => {
  assert.match(configSource, /'beatapi' \| 's3'/);
  assert.match(configSource, /WORKSPACE_STORAGE_MODE/);
  assert.match(configSource, /R2_ENDPOINT/);
  assert.match(configSource, /R2_PUBLIC_URL/);
  assert.match(configSource, /managedEligible/);
  assert.match(configSource, /validateTrustedLocalJsonMutation/);
});

test('generation-authorized upload defaults to BeatAPI files and can switch to S3', () => {
  assert.match(uploadSource, /\/v1\/files/);
  assert.match(uploadSource, /storageMode === 's3'/);
  assert.match(uploadSource, /new S3Provider\(config\)/);
  assert.match(uploadSource, /file\.type\.startsWith\('video\/'\)/);
  assert.doesNotMatch(uploadSource, /BEATAPI_MANAGED_R2/);
  assert.doesNotMatch(uploadSource, /process\.env/);
  assert.match(uploadSource, /loadCustomStorageConfig/);
  assert.match(uploadSource, /generationIntentToken/);
  assert.match(uploadSource, /claimGenerationUploadSlot/);
  assert.match(uploadSource, /completeGenerationUploadSlot/);
  assert.match(uploadSource, /DEFAULT_BEATAPI_BASE_URL/);
});
