import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';
import {
  captureTemplate,
  applyTemplateSlotBinding,
  getTemplateGenerationBlockers,
  instantiateTemplate,
  workflowTemplateDefinitionSchema,
} from './workflow-template';

const reference = {
  ...buildTextCard({ id: 'private-source', name: 'Character' }),
  kind: 'asset',
  type: 'image',
  assetId: 'private-asset',
  url: 'http://private/source.png',
} as CanvasCard;
const note = buildTextCard({
  id: 'notes',
  name: 'Direction',
  textContent: 'Slow movement',
  textRole: 'script',
});
const generation = {
  ...buildTextCard({ id: 'draft', name: 'Shot' }),
  kind: 'generation',
  type: 'video',
  modelId: 'test-video',
  prompt: 'Follow direction',
  referenceCardIds: [reference.id, note.id],
  sourceGenerationId: 'old-task',
  generationRunId: 'old-run',
  status: 'processing',
  url: 'http://private/output.mp4',
  assetId: 'old-result',
  pinnedOutputId: 'take-1',
  apiKey: 'dummy-private-key',
  parameters: { secret: 'dummy-private-key' },
} as CanvasCard;
const document = {
  cards: [reference, note, generation],
  frames: {
    notes: { x: 20, y: 30, w: 100, h: 80 },
    draft: { x: 160, y: 30, w: 180, h: 120 },
  },
};
const captured = () =>
  captureTemplate(document, ['private-source', 'notes', 'draft']);
const instantiate = (overrides: Record<string, unknown> = {}) =>
  instantiateTemplate({
    projectId: 'target',
    commandId: 'command-a',
    instanceId: 'instance-a',
    templateId: 'template-a',
    templateRevision: 1,
    definition: captured(),
    bindings: {},
    placement: { x: 400, y: 300 },
    availableModelIds: ['test-video'],
    createdAt: '2026-10-20T00:00:00.000Z',
    ...overrides,
  });

test('capture allowlists steps and converts private source media to ordered slots', () => {
  const definition = captured();
  assert.equal(definition.steps.length, 2);
  assert.equal(definition.slots.length, 1);
  assert.equal(definition.slots[0].consumers[0].order, 0);
  assert.equal(definition.edges[0].order, 1);
  const json = JSON.stringify(definition);
  for (const forbidden of [
    'private-source',
    'private-asset',
    'http://private',
    'old-task',
    'old-run',
    'old-result',
    'dummy-private-key',
    'pinnedOutputId',
  ])
    assert.equal(json.includes(forbidden), false, forbidden);
  assert.equal(
    workflowTemplateDefinitionSchema.safeParse({
      ...definition,
      credentials: 'bad',
    }).success,
    false
  );
  assert.equal(
    workflowTemplateDefinitionSchema.safeParse({
      ...definition,
      steps: definition.steps.map((step) => ({
        ...step,
        configuration: { ...step.configuration, url: '/private' },
      })),
    }).success,
    false
  );
});

test('unbound instance is editable but blocks generation without fake asset cards', () => {
  const result = instantiate();
  assert.equal(result.cards.length, 2);
  assert.equal(
    result.cards.every(
      (card) =>
        card.kind !== 'asset' && card.status === 'idle' && card.url === null
    ),
    true
  );
  const sourceCardId = result.cards.find(
    (card) => card.kind === 'generation'
  )!.id;
  const next = {
    cards: result.cards,
    organization: {
      templateInstances: { [result.instance.id]: result.instance },
    },
  };
  assert.equal(getTemplateGenerationBlockers(next, sourceCardId).length, 1);
  assert.equal(getTemplateGenerationBlockers(next, 'unrelated').length, 0);
  assert.equal(
    result.cards.every(
      (card) =>
        !card.sourceGenerationId &&
        !card.generationRunId &&
        !card.generationSnapshot
    ),
    true
  );
  assert.equal(
    result.cards.every((card) => card.workflowTemplateId === null),
    true
  );
});

test('explicit target binding preserves mixed reference order, stable retries and independent instances', () => {
  const slotId = captured().slots[0].id;
  const options = {
    bindings: {
      [slotId]: {
        assetId: 'target-asset',
        mediaType: 'image',
        url: '/api/target/asset.png',
      },
    },
  };
  const result = instantiate(options);
  assert.deepEqual(instantiate(options), result);
  const source = result.cards.find((card) => card.kind === 'generation')!;
  assert.equal(
    result.cards.find((card) => card.id === source.referenceCardIds[0])
      ?.assetId,
    'target-asset'
  );
  assert.equal(
    result.cards.find((card) => card.id === source.referenceCardIds[1])?.kind,
    'text'
  );
  const another = instantiate({
    ...options,
    commandId: 'command-b',
    instanceId: 'instance-b',
  });
  assert.equal(
    result.cards.some((card) =>
      another.cards.some((other) => other.id === card.id)
    ),
    false
  );
  assert.equal(
    getTemplateGenerationBlockers(
      {
        cards: result.cards,
        organization: {
          templateInstances: { [result.instance.id]: result.instance },
        },
      },
      source.id
    ).length,
    0
  );
  assert.throws(
    () =>
      instantiate({
        bindings: {
          [slotId]: {
            assetId: 'wrong-type',
            mediaType: 'audio',
            url: '/audio',
          },
        },
      }),
    /type/i
  );
  assert.throws(
    () => instantiate({ bindings: { unknown: options.bindings[slotId] } }),
    /slot/i
  );
});

test('capture rejects cycles, missing references, unsupported selections and ambiguous input positions', () => {
  assert.throws(
    () =>
      captureTemplate(
        {
          ...document,
          cards: [
            { ...note, referenceCardIds: ['draft'] },
            { ...generation, referenceCardIds: ['notes'] },
          ],
        },
        ['notes', 'draft']
      ),
    /cycl/i
  );
  assert.throws(
    () =>
      captureTemplate(
        {
          ...document,
          cards: [{ ...generation, referenceCardIds: ['missing'] }],
        },
        ['draft']
      ),
    /reference/i
  );
  assert.throws(() => captureTemplate(document, ['missing']), /selected/i);
  assert.throws(() => captureTemplate(document, ['private-source']), /step/i);
  const definition = captured();
  assert.equal(
    workflowTemplateDefinitionSchema.safeParse({
      ...definition,
      edges: [{ ...definition.edges[0], order: 0 }],
    }).success,
    false
  );
});

test('unavailable model is an editable warning and required slots are scoped to their consumers', () => {
  const result = instantiate({ availableModelIds: [] });
  assert.equal(result.warnings.length, 1);
  assert.equal(result.cards.length, 2);
  const source = result.cards.find((card) => card.kind === 'generation')!;
  const bound = instantiate({
    bindings: {
      [captured().slots[0].id]: {
        assetId: 'target',
        mediaType: 'image',
        url: '/target',
      },
    },
  });
  const instance = bound.instance;
  const referenceCard = bound.cards.find((card) => card.kind === 'asset')!;
  const broken = {
    cards: bound.cards.filter((card) => card.id !== referenceCard.id),
    organization: { templateInstances: { [instance.id]: instance } },
  };
  assert.equal(
    getTemplateGenerationBlockers(
      broken,
      bound.cards.find((card) => card.kind === 'generation')!.id
    ).length,
    1
  );
  assert.equal(source.modelId, 'test-video');
});

test('late slot binding and unbinding preserve frozen order around internal references', () => {
  const secondReference = {
    ...reference,
    id: 'another-source',
    name: 'Background',
  } as CanvasCard;
  const definition = captureTemplate(
    {
      ...document,
      cards: [
        reference,
        secondReference,
        note,
        {
          ...generation,
          referenceCardIds: [reference.id, note.id, secondReference.id],
        },
      ],
    },
    ['notes', 'draft']
  );
  const result = instantiate({ definition });
  const first = { assetId: 'first', referenceCardId: 'first-card' };
  const second = { assetId: 'second', referenceCardId: 'second-card' };
  const withAssets = [
    ...result.cards,
    { ...reference, id: first.referenceCardId, assetId: first.assetId },
    { ...secondReference, id: second.referenceCardId, assetId: second.assetId },
  ];
  const boundSecond = applyTemplateSlotBinding({
    cards: withAssets,
    instance: result.instance,
    slotId: definition.slots[1].id,
    binding: second,
  });
  const sourceId = result.instance.stepCardIds['step-2'];
  const noteId = result.instance.stepCardIds['step-1'];
  assert.deepEqual(
    boundSecond.cards.find((card) => card.id === sourceId)?.referenceCardIds,
    [noteId, second.referenceCardId]
  );
  const boundFirst = applyTemplateSlotBinding({
    ...boundSecond,
    slotId: definition.slots[0].id,
    binding: first,
  });
  assert.deepEqual(
    boundFirst.cards.find((card) => card.id === sourceId)?.referenceCardIds,
    [first.referenceCardId, noteId, second.referenceCardId]
  );
  const unbound = applyTemplateSlotBinding({
    ...boundFirst,
    slotId: definition.slots[0].id,
    binding: null,
  });
  assert.deepEqual(
    unbound.cards.find((card) => card.id === sourceId)?.referenceCardIds,
    [noteId, second.referenceCardId]
  );
  const blockers = getTemplateGenerationBlockers(
    {
      cards: unbound.cards,
      organization: {
        templateInstances: { [result.instance.id]: unbound.instance },
      },
    },
    sourceId
  );
  assert.equal(blockers.length, 1);
  assert.equal(result.instance.slotBindings[definition.slots[0].id], undefined);
});
