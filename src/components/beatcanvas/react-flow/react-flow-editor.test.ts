import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('uses a controlled React Flow canvas with custom VisuGen nodes', () => {
  const source = readFileSync(
    new URL('./react-flow-editor.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /<ReactFlow<BeatCanvasFlowNode,\s*BeatCanvasFlowEdge>/);
  assert.match(source, /nodes=\{lineagePresentation\.nodes\}/);
  assert.match(source, /edges=\{lineagePresentation\.edges\}/);
  assert.match(source, /visugenLineageRole/);
  assert.match(source, /onNodesChange=\{onNodesChange\}/);
  assert.match(source, /nodeTypes=\{nodeTypes\}/);
  assert.match(source, /edgeTypes=\{edgeTypes\}/);
  assert.match(source, /proOptions=\{\{ hideAttribution: true \}\}/);
  assert.match(source, /<MiniMap/);
});

test('keeps React Flow state out of the persisted project document', () => {
  const editorSource = readFileSync(
    new URL('./react-flow-editor.tsx', import.meta.url),
    'utf8'
  );
  const adapterSource = readFileSync(
    new URL('../use-beatcanvas-react-flow-adapter.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(editorSource, /toObject\(/);
  assert.match(
    adapterSource,
    /buildProjectSnapshotDocumentFromCards\(\{/
  );
  assert.match(adapterSource, /cardsById:\s*canvasCardsRef\.current/);
  assert.match(adapterSource, /camera:\s*editor\?\.getCamera\(\)/);
  assert.match(
    adapterSource,
    /editorRef\.current\?\.setCamera\(document\.camera/
  );
});

test('propagates a completed canvas drag into the project snapshot autosave signal', () => {
  const editorSource = readFileSync(
    new URL('./react-flow-editor.tsx', import.meta.url),
    'utf8'
  );
  const studioSource = readFileSync(
    new URL('../beatcanvas-shell.tsx', import.meta.url),
    'utf8'
  );

  assert.match(editorSource, /onDocumentChange\?: \(\) => void/);
  assert.match(editorSource, /onDocumentChange\?\.\(\)/);
  assert.match(
    studioSource,
    /const \[canvasDocumentRevision, setCanvasDocumentRevision\] = useState\(0\)/
  );
  assert.match(
    studioSource,
    /onDocumentChange=\{handleCanvasDocumentChange\}/
  );
  assert.match(studioSource, /canvasDocumentRevision,/);
});

test('propagates a completed viewport move into the project snapshot autosave signal', () => {
  const editorSource = readFileSync(
    new URL('./react-flow-editor.tsx', import.meta.url),
    'utf8'
  );

  assert.match(editorSource, /const handleMoveEnd = useCallback/);
  assert.match(editorSource, /editor\.setViewportState\(viewport\)/);
  assert.match(editorSource, /onMoveEnd=\{handleMoveEnd\}/);
});
