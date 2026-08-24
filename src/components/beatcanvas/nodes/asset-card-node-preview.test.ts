import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('asset image cards expose a double-click preview event without previewing svg structure cards', () => {
  const source = readFileSync(
    new URL('./asset-card-node.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /onDoubleClick/);
  assert.match(source, /beatcanvas:preview-media/);
  assert.match(source, /!thumbnailUrl\.startsWith\('data:image\/svg\+xml'\)/);
});

test('asset cards render videos as draggable video surfaces', () => {
  const source = readFileSync(
    new URL('./asset-card-node.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /cardMediaType === 'video'/);
  assert.match(source, /<video/);
  assert.match(source, /muted/);
  assert.match(source, /playsInline/);
  assert.match(source, /className="nowheel"/);
  assert.doesNotMatch(source, /className="nodrag nowheel"/);
  assert.match(source, /cursor-grab active:cursor-grabbing/);
});

test('asset video cards expose a clickable playback entry', () => {
  const source = readFileSync(
    new URL('./asset-card-node.tsx', import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /mediaStatus === 'ready'[\s\S]*?<button[\s\S]*?onClick=\{handlePreviewMedia\}/
  );
  assert.match(source, /className="nodrag nopan nowheel/);
  assert.match(source, /aria-label=\{`\$\{shapeCopy\.viewResult\}/);
});
