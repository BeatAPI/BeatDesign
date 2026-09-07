import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard } from './canvas-types';
import {
  buildCanvasReferenceMentions,
  CANONICAL_FIRST_FRAME_PROMPT_DIRECTIVE,
  ensureCanvasFirstFramePromptDirective,
  filterCanvasReferenceMentions,
  findActiveCanvasReferenceMention,
  insertCanvasReferenceMention,
  moveCanvasReferenceCardId,
  rewriteCanvasReferenceAliases,
} from './reference-mentions';

const makeCard = (
  id: string,
  type: CanvasCard['type'],
  name: string
): CanvasCard => ({
  id,
  kind: 'asset',
  type,
  name,
  url: `https://example.com/${id}`,
  prompt: '',
  referenceCardIds: [],
  workflowTemplateId: null,
  status: 'succeeded',
  error: null,
  modelId: '',
  aspectRatio: '1:1',
  outputQuality: '1k',
  duration: '5s',
  mode: 'quality',
  variant: 'standard',
  quality: 'standard',
  sourceGenerationId: null,
});

const cards = {
  person: makeCard('person', 'image', 'Portrait'),
  motion: makeCard('motion', 'video', 'Dance motion'),
  outfit: makeCard('outfit', 'image', 'Couture dress'),
  camera: makeCard('camera', 'video', 'Camera move'),
};

test('numbers images and videos independently in API order', () => {
  assert.deepEqual(
    buildCanvasReferenceMentions({
      referenceCardIds: ['person', 'motion', 'outfit', 'camera'],
      cards,
    }).map(({ cardId, alias }) => ({ cardId, alias })),
    [
      { cardId: 'person', alias: '@Image1' },
      { cardId: 'motion', alias: '@Video1' },
      { cardId: 'outfit', alias: '@Image2' },
      { cardId: 'camera', alias: '@Video2' },
    ]
  );
});

test('adds one canonical first-frame directive without rewriting the creative prompt', () => {
  assert.equal(
    ensureCanvasFirstFramePromptDirective('雪の粒子が舞い始める。'),
    `${CANONICAL_FIRST_FRAME_PROMPT_DIRECTIVE}\n\n雪の粒子が舞い始める。`
  );
  assert.equal(
    ensureCanvasFirstFramePromptDirective(
      'Use @Image1 as the first frame while the camera moves forward.'
    ),
    'Use @Image1 as the first frame while the camera moves forward.'
  );
  assert.equal(
    ensureCanvasFirstFramePromptDirective('将 @Image1 作为首帧，继续镜头。'),
    `${CANONICAL_FIRST_FRAME_PROMPT_DIRECTIVE}\n\n将 @Image1 作为首帧，继续镜头。`
  );
});

test('finds and replaces the active @ query at the caret', () => {
  const prompt = 'Keep @Im';
  const activeMention = findActiveCanvasReferenceMention({
    prompt,
    caret: prompt.length,
  });
  assert.deepEqual(activeMention, {
    start: 5,
    end: 8,
    query: 'Im',
  });
  assert.deepEqual(
    insertCanvasReferenceMention({
      prompt,
      alias: '@Image1',
      selectionStart: prompt.length,
      selectionEnd: prompt.length,
      activeMention,
    }),
    { prompt: 'Keep @Image1', caret: 12 }
  );
});

test('filters references by alias, type, and card name', () => {
  const mentions = buildCanvasReferenceMentions({
    referenceCardIds: ['person', 'motion'],
    cards,
  });
  assert.deepEqual(
    filterCanvasReferenceMentions({ mentions, query: 'dance' }).map(
      (mention) => mention.alias
    ),
    ['@Video1']
  );
});

test('rewrites aliases atomically when same-type references reorder', () => {
  const previousMentions = buildCanvasReferenceMentions({
    referenceCardIds: ['person', 'outfit'],
    cards,
  });
  const nextMentions = buildCanvasReferenceMentions({
    referenceCardIds: ['outfit', 'person'],
    cards,
  });
  assert.equal(
    rewriteCanvasReferenceAliases({
      prompt: 'Keep @Image1 identity and use @Image2 clothing.',
      previousMentions,
      nextMentions,
    }),
    'Keep @Image2 identity and use @Image1 clothing.'
  );
});

test('moves a reference without dropping mixed media entries', () => {
  assert.deepEqual(
    moveCanvasReferenceCardId({
      referenceCardIds: ['person', 'motion', 'outfit'],
      activeCardId: 'outfit',
      overCardId: 'person',
    }),
    ['outfit', 'person', 'motion']
  );
});
