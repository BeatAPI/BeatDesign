import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('./generation-card-node.tsx', import.meta.url),
  'utf8'
);

test('generation media remains a full-card drag surface', () => {
  assert.match(source, /className="group cursor-grab active:cursor-grabbing"/);
  assert.match(
    source,
    /<video[\s\S]*?preload="metadata"[\s\S]*?className="nowheel"/
  );
  assert.match(
    source,
    /<img[\s\S]*?draggable=\{false\}[\s\S]*?className="nowheel"/
  );
});

test('generation cards report pointer hover intent for the attached composer', () => {
  assert.match(source, /fireGenerationCardHover/);
  assert.match(
    source,
    /onPointerEnter=\{\(\) => fireGenerationCardHover\(id, true\)\}/
  );
  assert.match(
    source,
    /onPointerLeave=\{\(\) => fireGenerationCardHover\(id, false\)\}/
  );
});

test('generation node leaves prompt and parameters to the attached Composer', () => {
  assert.doesNotMatch(source, /shapeCopy\.versions/);
  assert.doesNotMatch(source, /latestModelLabel/);
  assert.doesNotMatch(source, /latestOutputQuality/);
  assert.match(source, /latestOutputUrl/);
  assert.match(source, /beatcanvas:pin-generation-output/);
  assert.match(source, /beatcanvas:preview-media/);
  assert.match(source, /Take \$\{take\.takeNumber\}/);
});

test('analysis reports expose selectable read-only text without dragging the node', () => {
  assert.match(
    source,
    /<textarea[\s\S]*?readOnly[\s\S]*?value=\{latestOutputText\}/
  );
  assert.match(
    source,
    /className="nodrag nopan nowheel[^"]*cursor-text[^"]*selection:bg-/
  );
  assert.match(
    source,
    /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/
  );
});

test('generated videos expose a direct playback entry', () => {
  assert.match(source, /const handlePreviewLatestOutput/);
  assert.match(
    source,
    /cardMediaType === 'video'[\s\S]*?<button[\s\S]*?handlePreviewLatestOutput/
  );
  assert.match(
    source,
    /<video[\s\S]*?onDoubleClick=\{[\s\S]*?handlePreviewLatestOutput/
  );
  assert.match(source, /seekStaticVideoPreview\(event\.currentTarget\)/);
});

test('generated images open the same unified media preview on double click', () => {
  assert.match(
    source,
    /<img[\s\S]*?onDoubleClick=\{[\s\S]*?handlePreviewLatestOutput/
  );
  assert.match(source, /type: cardMediaType/);
  assert.match(source, /cursor: 'zoom-in'/);
});
