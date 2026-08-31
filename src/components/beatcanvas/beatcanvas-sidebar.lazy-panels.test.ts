import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('keeps sidebar panel-only data and template code out of the toolbar module', () => {
  const source = readFileSync(
    new URL('./beatcanvas-sidebar.tsx', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /fetchRecentAssets/);
  assert.doesNotMatch(source, /recentAssetsKeys/);
  assert.doesNotMatch(source, /useQuery/);
  // the template library entry point was removed with the template system
  assert.doesNotMatch(source, /TemplatesPanel/);
  assert.doesNotMatch(source, /'templates'/);

  assert.match(
    source,
    /const HistoryPanel = lazy\(\(\) =>\s+import\(['"]\.\/beatcanvas-sidebar-panels['"]\)/
  );
  assert.match(source, /onUploadMedia/);
  assert.match(source, /onCreateImageDraft/);
  assert.doesNotMatch(source, /onCreateVideoDraft/);
  assert.doesNotMatch(source, /handleTogglePanel\('upload'\)/);
  assert.match(source, /toolbar\.generationNode/);
  assert.match(source, /toolbar\.uploadNode/);
  assert.doesNotMatch(source, /onOpenGenerationComposer/);
});
