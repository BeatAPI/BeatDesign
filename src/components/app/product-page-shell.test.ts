import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shellSource = readFileSync(
  new URL('./product-page-shell.tsx', import.meta.url),
  'utf8'
);

test('workspace logo returns to the real Home route', () => {
  assert.match(shellSource, /href="\/"/);
  assert.doesNotMatch(shellSource, /href=\{Routes\.History\}/);
});
const apiConfigSource = readFileSync(
  new URL('./workspace-api-config-dialog.tsx', import.meta.url),
  'utf8'
);

test('workspace header keeps mode switching, shared assets, and API configuration actions', () => {
  assert.match(shellSource, /WorkspaceApiConfigDialog/);
  assert.match(shellSource, /ProjectAssetsDialog/);
  assert.match(shellSource, /GitHubIcon/);
  assert.match(
    shellSource,
    /https:\/\/github\.com\/BeatAPI\/beatapi-workspace/
  );
  assert.match(shellSource, /target="_blank"/);
  assert.match(shellSource, /rel="noreferrer"/);
  assert.match(shellSource, />Studio<\/span>/);
  assert.match(shellSource, />Canvas<\/span>/);
  assert.match(shellSource, /\{ workspaceMode \}/);
  assert.doesNotMatch(shellSource, /usePricingModal/);
  assert.doesNotMatch(shellSource, /credits\.upgrade/);
  assert.doesNotMatch(shellSource, /getUserInitial/);
});

test('API configuration presets the BeatAPI endpoint and saves key + host', () => {
  assert.match(apiConfigSource, /getBeatCanvasProviderPublicConfig/);
  assert.match(apiConfigSource, /DEFAULT_BEATAPI_BASE_URL/);
  assert.match(apiConfigSource, /\/api\/config\/beatapi/);
  assert.match(apiConfigSource, /\/api\/config\/storage/);
  assert.match(apiConfigSource, /'beatapi' \| 's3'/);
  assert.match(apiConfigSource, /apiGet<StorageConfigState>\('\/api\/config\/storage'\)/);
  assert.match(apiConfigSource, /apiPost\('\/api\/config\/storage'/);
  assert.match(apiConfigSource, /https:\/\/beatapi\.io\/dashboard\/apikeys/);
  assert.doesNotMatch(apiConfigSource, /apiJson(?:Get|Post).*\/api\/config\/storage/);
});
