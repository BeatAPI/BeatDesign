import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard, resolveCanvasTextReferences } from './text-nodes';
import {
  buildCanvasReferenceMentions,
  rewriteCanvasReferenceAliases,
} from './reference-mentions';
import {
  canvasOperationSchema,
  canvasCardSchema,
} from '@/core/commands/schema';
import { applyCanvasOperations } from '@/core/commands/canvas-commands';
import {
  createEmptyProjectSnapshot,
  normalizeProjectSnapshotDocument,
} from '@/core/projects/project-snapshot';
import { createProjectSnapshotRestorePlan } from '@/core/projects/project-canvas-document';
import { buildProjectSnapshotDocument } from '@/core/projects/project-canvas-document';
import { buildCanvasOperations } from '@/core/commands/canvas-diff';
import { mergeProjectSnapshotsAfterConflict } from '@/components/beatcanvas/use-project-snapshot-lifecycle';
import { prepareCanvasGenerationSubmission } from '@/mcp/generation-canvas';
import { getGenerationModelDescriptor } from '@/core/generation-providers';
import type { CanvasGenerationCard } from './canvas-types';

test('MCP text operations persist unicode, purpose and frames without creating a media asset', () => {
  const create = canvasOperationSchema.parse({
    type: 'upsert_text',
    cardId: 'script',
    name: '剧本',
    textRole: 'script',
    textContent: '# 第一幕\n小树懒出发。',
    frame: { x: 12, y: 34, w: 420, h: 360 },
  });
  const first = applyCanvasOperations(createEmptyProjectSnapshot(), [
    create,
  ]).document;
  const edited = applyCanvasOperations(first, [
    { type: 'upsert_text', cardId: 'script', textContent: '第二版\n保留换行' },
  ]).document;
  const restored = normalizeProjectSnapshotDocument(
    JSON.parse(JSON.stringify(edited))
  );
  assert.equal(restored.cards[0].textContent, '第二版\n保留换行');
  assert.equal(restored.cards[0].textRole, 'script');
  assert.deepEqual(restored.frames, first.frames);
  assert.equal(createProjectSnapshotRestorePlan(restored).textCards.length, 1);
  assert.equal(restored.cards[0].url, null);
  assert.equal(restored.cards[0].assetId, null);
});

test('text cannot masquerade as a media asset and oversized commands are rejected', () => {
  const text = buildTextCard({ id: 'text', name: '角色' });
  assert.equal(
    canvasCardSchema.safeParse({ ...text, assetId: 'some-image' }).success,
    false
  );
  assert.equal(
    canvasOperationSchema.safeParse({
      type: 'upsert_text',
      cardId: 'x',
      textContent: 'x'.repeat(100_001),
    }).success,
    false
  );
  assert.throws(
    () =>
      applyCanvasOperations(
        {
          ...createEmptyProjectSnapshot(),
          cards: [{ ...text, kind: 'generation', type: 'image' }],
        },
        [{ type: 'upsert_text', cardId: 'text', textContent: 'overwrite' }]
      ),
    /not a text node/
  );
});

test('text aliases have separate numbering and remain stable when references reorder', () => {
  const a = buildTextCard({ id: 'a', name: '角色', textContent: '红围巾' });
  const b = buildTextCard({ id: 'b', name: '镜头', textContent: '缓慢推进' });
  const image = {
    ...a,
    id: 'image',
    kind: 'asset' as const,
    type: 'image' as const,
    url: '/image.png',
  };
  const cards = { a, b, image };
  const previousMentions = buildCanvasReferenceMentions({
    cards,
    referenceCardIds: ['a', 'image', 'b'],
  });
  assert.deepEqual(
    previousMentions.map((m) => m.alias),
    ['@Text1', '@Image1', '@Text2']
  );
  const nextMentions = buildCanvasReferenceMentions({
    cards,
    referenceCardIds: ['b', 'image', 'a'],
  });
  assert.equal(
    rewriteCanvasReferenceAliases({
      prompt: '@Text1 + @Text2 + @Image1',
      previousMentions,
      nextMentions,
    }),
    '@Text2 + @Text1 + @Image1'
  );
});

test('shared text is frozen into generation snapshots and does not consume media slots', () => {
  const text = buildTextCard({
    id: 'role',
    name: '主角',
    textRole: 'character',
    textContent: 'A sloth wearing a red scarf.',
  });
  const draft: CanvasGenerationCard = {
    ...text,
    id: 'shot',
    kind: 'generation',
    type: 'image',
    prompt: 'Walking through the forest. @Text1',
    modelId: 'nano-banana-pro',
    referenceCardIds: ['role'],
  };
  const plan = prepareCanvasGenerationSubmission({
    cards: [text, draft],
    sourceCardId: 'shot',
    submitted: {
      mode: 'image',
      modelId: draft.modelId,
      prompt: draft.prompt,
      references: [],
      parameters: {},
    },
    descriptor: getGenerationModelDescriptor(draft.modelId)!,
    outputCardId: 'take',
    generationRunId: 'run',
    capturedAt: '2026-10-17T00:00:00Z',
  });
  assert.deepEqual(plan.request.references, []);
  assert.equal(plan.request.textReferences?.[0].textContent, text.textContent);
  text.textContent = 'A different character.';
  assert.equal(
    plan.outputCard.generationSnapshot.textReferences?.[0].textContent,
    'A sloth wearing a red scarf.'
  );
  assert.match(plan.outputCard.generationSnapshot.resolvedPrompt!, /red scarf/);
});

test('empty referenced text fails explicitly', () => {
  const text = buildTextCard({ id: 'empty', name: 'Empty script' });
  assert.throws(
    () =>
      resolveCanvasTextReferences({
        cards: { empty: text },
        referenceCardIds: ['empty'],
        prompt: 'Animate',
      }),
    /empty/i
  );
});

test('canonical text capture does not create spurious autosaves and keeps Agent edits', () => {
  const text = buildTextCard({
    id: 'script',
    name: 'Script',
    textContent: 'Original',
  });
  const base = normalizeProjectSnapshotDocument({
    version: 3,
    cards: [text],
    frames: { script: { x: 0, y: 0, w: 420, h: 360 } },
  });
  const capture = buildProjectSnapshotDocument({
    cardsById: { script: text },
    framesById: base.frames,
  });
  assert.deepEqual(buildCanvasOperations(base, capture), []);
  const local = {
    ...capture,
    frames: { script: { ...base.frames.script, x: 200 } },
  };
  const remote = {
    ...base,
    cards: base.cards.map((card) => ({
      ...card,
      textContent: 'Agent revision',
    })),
  };
  const merged = mergeProjectSnapshotsAfterConflict({ base, local, remote });
  assert.equal(merged.cards[0].textContent, 'Agent revision');
  assert.equal(merged.frames.script.x, 200);
  const conflicting = {
    ...local,
    cards: local.cards.map((card) => ({
      ...card,
      textContent: 'Human revision',
    })),
  };
  assert.throws(
    () =>
      mergeProjectSnapshotsAfterConflict({ base, local: conflicting, remote }),
    /Canvas edit conflict/
  );
});

test('dangling text aliases cannot silently generate without their context', () => {
  assert.throws(
    () =>
      resolveCanvasTextReferences({
        cards: {},
        referenceCardIds: [],
        prompt: 'Use @Text1',
      }),
    /missing/
  );
  assert.throws(
    () =>
      resolveCanvasTextReferences({
        cards: {},
        referenceCardIds: [],
        prompt: 'Use @RemovedText',
      }),
    /removed/
  );
});

test('removing a text node cannot silently retarget an alias to a different document', () => {
  const first = buildTextCard({
    id: 'first',
    name: 'First',
    textContent: 'First character',
  });
  const second = buildTextCard({
    id: 'second',
    name: 'Second',
    textContent: 'Second character',
  });
  const draft: CanvasGenerationCard = {
    ...first,
    id: 'draft',
    kind: 'generation',
    type: 'image',
    prompt: 'Use @Text1 and @Text2',
    modelId: 'nano-banana-pro',
    referenceCardIds: ['first', 'second'],
  };
  const base = normalizeProjectSnapshotDocument({
    cards: [first, second, draft],
    frames: {},
  });
  const deleted = applyCanvasOperations(base, [
    { type: 'remove_card', cardId: first.id },
  ]).document;
  const next = deleted.cards.find((card) => card.id === draft.id)!;
  assert.deepEqual(next.referenceCardIds, ['second']);
  assert.equal(next.prompt, 'Use @RemovedText and @Text1');
});
