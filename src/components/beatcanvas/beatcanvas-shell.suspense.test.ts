import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('keeps the sidebar outside the React Flow Suspense fallback', () => {
  const source = readFileSync(
    new URL('./beatcanvas-shell.tsx', import.meta.url),
    'utf8'
  );

  const suspenseStart = source.indexOf(
    '<Suspense fallback={<BeatCanvasLoading />}>'
  );
  const suspenseEnd = source.indexOf('</Suspense>', suspenseStart);
  const sidebarStart = source.indexOf('<BeatCanvasSidebar');

  assert.notEqual(suspenseStart, -1);
  assert.notEqual(suspenseEnd, -1);
  assert.notEqual(sidebarStart, -1);
  assert.ok(
    sidebarStart > suspenseEnd,
    'BeatCanvasSidebar should render outside the React Flow Suspense boundary'
  );
});

test('keeps non-critical canvas overlays out of the studio shell static imports', () => {
  const source = readFileSync(
    new URL('./beatcanvas-shell.tsx', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(
    source,
    /import\s+\{\s*BeatCanvasContextToolbar\s*\}\s+from\s+['"]\.\/beatcanvas-context-toolbar['"]/
  );
  assert.doesNotMatch(
    source,
    /import\s+\{\s*BeatCanvasMediaPreviewOverlay/
  );
  assert.doesNotMatch(
    source,
    /import\s+\{\s*BeatCanvasStatusPill\s*\}\s+from\s+['"]\.\/beatcanvas-status-pill['"]/
  );

  assert.match(
    source,
    /const BeatCanvasContextToolbar = lazy\(\(\) =>\s+import\(['"]\.\/beatcanvas-context-toolbar['"]\)/
  );
  assert.match(
    source,
    /const BeatCanvasMediaPreviewOverlay = lazy\(\(\) =>\s+import\(['"]\.\/beatcanvas-media-preview-overlay['"]\)/
  );
  assert.match(
    source,
    /const BeatCanvasStatusPill = lazy\(\(\) =>\s+import\(['"]\.\/beatcanvas-status-pill['"]\)/
  );
});
