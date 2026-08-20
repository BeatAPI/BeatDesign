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
  assert.doesNotMatch(source, /ECOMMERCE_COLLAGE_TEMPLATE_PREVIEW_PATH/);
  assert.doesNotMatch(source, /VIRTUAL_MODEL_TRYON_TEMPLATE_PREVIEW_PATH/);
  assert.doesNotMatch(source, /ECOMMERCE_VIDEO_AD_TEMPLATE_PREVIEW_PATH/);
  // the template library entry point was removed with the template system
  assert.doesNotMatch(source, /TemplatesPanel/);
  assert.doesNotMatch(source, /'templates'/);
  assert.doesNotMatch(source, /workflows\.ecommerceVideo\.title/);
  assert.doesNotMatch(source, /onOpenEcommerceVideoAd/);

  assert.match(
    source,
    /const UploadNodePanel = lazy\(\(\) =>\s+import\(['"]\.\/beatcanvas-sidebar-panels['"]\)/
  );
  assert.match(
    source,
    /const HistoryPanel = lazy\(\(\) =>\s+import\(['"]\.\/beatcanvas-sidebar-panels['"]\)/
  );
  assert.match(source, /UploadNodePanel/);
  assert.match(source, /onCreateImageDraft/);
  assert.doesNotMatch(source, /onCreateVideoDraft/);
  assert.match(source, /handleTogglePanel\('upload'\)/);
  assert.match(source, /toolbar\.generationNode/);
  assert.match(source, /toolbar\.uploadNode/);
  assert.doesNotMatch(source, /onOpenGenerationComposer/);
});
