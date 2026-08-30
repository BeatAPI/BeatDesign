import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';

const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');

test('MCP registers Canvas, Generation, and Editor tool groups', () => {
  for (const tool of BEATDESIGN_MCP_TOOL_NAMES) {
    assert.match(source, new RegExp(`['"]${tool}['"]`));
  }
});

test('MCP writes use a fixed origin and never expose document replacement', () => {
  assert.match(source, /origin: 'mcp'/);
  assert.doesNotMatch(source, /editor\.replace_document/);
  assert.doesNotMatch(source, /saveProjectSnapshot/);
  assert.doesNotMatch(source, /saveProjectTimeline/);
});

test('external generation submits directly and leaves API policy to BeatAPI', () => {
  assert.match(source, /submitAssetFirstGeneration/);
  assert.doesNotMatch(source, /confirmedExternalGeneration/);
  assert.doesNotMatch(source, /CONFIRMATION_REQUIRED/);
  assert.doesNotMatch(source, /generation-confirm/);
});

test('MCP advertises concrete Canvas and Editor operation schemas', () => {
  assert.match(source, /z\.array\(canvasOperationSchema\)/);
  assert.match(source, /z\.array\(editorOperationSchema\)/);
  assert.doesNotMatch(source, /operations:\s*z\.array\(z\.unknown\(\)\)/);
});
