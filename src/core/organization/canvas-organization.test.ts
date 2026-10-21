import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard } from '../beatcanvas/text-nodes';
import type { CanvasCard } from '../beatcanvas/canvas-types';
import {
  applyCanvasOrganizationOperations,
  cleanupCanvasOrganizationForRemovedCards,
  createEmptyCanvasOrganization,
  normalizeCanvasOrganization,
  validateCanvasOrganization,
} from './canvas-organization';

const frame = { x: 10, y: 20, w: 100, h: 80 };
const card = (id: string): CanvasCard =>
  buildTextCard({ id, name: id, textContent: id, textRole: 'note' });
const source = () => ({
  version: 4 as const,
  cards: [card('a'), card('b')],
  frames: { a: frame, b: { ...frame, x: 130 } },
  organization: createEmptyCanvasOrganization(),
});
const create = {
  type: 'create_group' as const,
  groupId: 'g',
  name: 'Shot 1',
  role: 'shot' as const,
  memberCardIds: ['a', 'b'],
  summaryFrame: frame,
  expandedFrame: { x: 0, y: 0, w: 250, h: 120 },
};

test('group collapse, move, resize and removal preserve media, exact references and absolute frames', () => {
  const original = source();
  const grouped = applyCanvasOrganizationOperations(original, [
    create,
    { type: 'set_group_collapsed', groupId: 'g', collapsed: true },
  ]).document;
  assert.deepEqual(grouped.frames, original.frames);
  const moved = applyCanvasOrganizationOperations(grouped, [
    { type: 'move_group', groupId: 'g', deltaX: 20, deltaY: -5 },
  ]).document;
  assert.deepEqual(moved.frames.a, { ...frame, x: 30, y: 15 });
  assert.deepEqual(moved.cards, original.cards);
  const resized = applyCanvasOrganizationOperations(moved, [
    {
      type: 'resize_group',
      groupId: 'g',
      target: 'summary',
      frame: { x: 30, y: 15, w: 200, h: 120 },
    },
  ]).document;
  assert.deepEqual(resized.frames, moved.frames);
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(resized, [
        { type: 'resize_group', groupId: 'g', target: 'expanded', frame },
      ]),
    /bounds|contain/i
  );
  const removed = applyCanvasOrganizationOperations(resized, [
    { type: 'remove_group', groupId: 'g' },
  ]).document;
  assert.deepEqual(removed.cards, original.cards);
  assert.deepEqual(removed.frames, moved.frames);
  assert.equal(Object.keys(removed.organization.groups).length, 0);
  assert.deepEqual(
    original,
    source(),
    'operations must not mutate caller state'
  );
});

test('batch validates final membership and rejects invalid or reused group IDs atomically', () => {
  const first = applyCanvasOrganizationOperations(source(), [create]).document;
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(first, [
        { ...create, name: 'Different' },
      ]),
    /already|different/i
  );
  const moved = applyCanvasOrganizationOperations(first, [
    { ...create, groupId: 'g2', memberCardIds: ['a'] },
    { type: 'set_group_members', groupId: 'g', memberCardIds: ['b'] },
  ]).document;
  validateCanvasOrganization(moved);
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(first, [{ ...create, groupId: 'g2' }]),
    /one group|multiple|belongs/i
  );
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(first, [
        { ...create, groupId: 'missing', memberCardIds: ['outside'] },
      ]),
    /missing|unknown/i
  );
  assert.throws(
    () =>
      normalizeCanvasOrganization({
        ...createEmptyCanvasOrganization(),
        unexpected: true,
      }),
    /Unrecognized|unrecognized/
  );
});

test('remove-card cleanup clears result and metadata while keeping old media and snapshots', () => {
  const grouped = applyCanvasOrganizationOperations(source(), [
    create,
    { type: 'update_group', groupId: 'g', resultCardId: 'a' },
  ]).document;
  const cleaned = cleanupCanvasOrganizationForRemovedCards(grouped, ['a']);
  assert.deepEqual(cleaned.organization.groups.g.memberCardIds, ['b']);
  assert.equal(cleaned.organization.groups.g.resultCardId, null);
  assert.deepEqual(
    cleaned.cards,
    grouped.cards,
    'cleanup organizes only; caller owns card removal'
  );
});

test('element bindings pin real assets and keep/adopt revisions without touching historical output', () => {
  const a = {
    ...card('asset-a'),
    kind: 'asset',
    type: 'image',
    assetId: 'asset-1',
  } as CanvasCard;
  const b = { ...a, id: 'asset-b', assetId: 'asset-2' } as CanvasCard;
  const consumer = {
    ...card('consumer'),
    kind: 'generation',
    type: 'image',
    referenceCardIds: [],
  } as CanvasCard;
  const doc = {
    cards: [a, b, consumer],
    frames: {},
    organization: createEmptyCanvasOrganization(),
  };
  const binding = {
    id: 'binding',
    consumerCardId: 'consumer',
    elementId: 'lulu',
    versionId: 'v1',
    assetId: 'asset-1',
    referenceCardId: 'asset-a',
    order: 0,
    role: 'subject' as const,
    reviewedAgainstCurrentVersionId: 'v1',
  };
  const { id: bindingId, ...bindingFields } = binding;
  const bound = applyCanvasOrganizationOperations(doc, [
    { type: 'bind_element', bindingId, ...bindingFields },
  ]).document;
  assert.deepEqual(
    bound.cards.find((c) => c.id === 'consumer')?.referenceCardIds,
    ['asset-a']
  );
  const kept = applyCanvasOrganizationOperations(bound, [
    {
      type: 'review_element_binding',
      bindingId: binding.id,
      observedCurrentVersionId: 'v2',
      decision: 'keep',
    },
  ]).document;
  assert.equal(kept.organization.elementBindings.binding.versionId, 'v1');
  assert.equal(
    kept.organization.elementBindings.binding.reviewedAgainstCurrentVersionId,
    'v2'
  );
  const adopted = applyCanvasOrganizationOperations(kept, [
    {
      type: 'review_element_binding',
      bindingId: binding.id,
      observedCurrentVersionId: 'v2',
      decision: 'adopt',
      binding: {
        ...binding,
        versionId: 'v2',
        assetId: 'asset-2',
        referenceCardId: 'asset-b',
        reviewedAgainstCurrentVersionId: 'v2',
      },
    },
  ]).document;
  assert.deepEqual(
    adopted.cards.find((c) => c.id === 'consumer')?.referenceCardIds,
    ['asset-b']
  );
  const unbound = applyCanvasOrganizationOperations(adopted, [
    { type: 'unbind_element', bindingId: binding.id },
  ]).document;
  assert.deepEqual(
    unbound.cards.find((c) => c.id === 'consumer')?.referenceCardIds,
    []
  );
  assert.deepEqual(bound.cards[0], a);
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(doc, [
        { type: 'bind_element', bindingId, ...bindingFields, assetId: 'other' },
      ]),
    /asset/i
  );
});

test('cleanup removes deleted reference bindings and rebases surviving reference positions', () => {
  const a = {
    ...card('a'),
    kind: 'asset',
    type: 'image',
    assetId: 'asset-a',
  } as CanvasCard;
  const b = { ...a, id: 'b', assetId: 'asset-b' } as CanvasCard;
  const consumer = {
    ...card('consumer'),
    kind: 'generation',
    type: 'image',
    referenceCardIds: ['a', 'b'],
  } as CanvasCard;
  const original = {
    cards: [a, b, consumer],
    frames: {},
    organization: createEmptyCanvasOrganization(),
  };
  original.organization.elementBindings.b = {
    id: 'b',
    elementId: 'character',
    versionId: 'v1',
    assetId: 'asset-b',
    referenceCardId: 'b',
    consumerCardId: 'consumer',
    order: 1,
    role: 'subject',
    reviewedAgainstCurrentVersionId: 'v1',
  };
  const clean = cleanupCanvasOrganizationForRemovedCards(original, ['a']);
  assert.equal(clean.organization.elementBindings.b.order, 0);
  clean.cards = clean.cards
    .filter((card) => card.id !== 'a')
    .map((card) => ({
      ...card,
      referenceCardIds: card.referenceCardIds.filter((id) => id !== 'a'),
    }));
  validateCanvasOrganization(clean);
  assert.equal(original.organization.elementBindings.b.order, 1);
});

test('late Element-backed template slot binding rebases and removes fixed Element metadata', () => {
  const a = {
    ...card('a'),
    kind: 'asset',
    type: 'image',
    assetId: 'asset-a',
    url: '/asset-a.png',
  } as CanvasCard;
  const b = {
    ...a,
    id: 'b',
    assetId: 'asset-b',
    url: '/asset-b.png',
  } as CanvasCard;
  const consumer = {
    ...card('consumer'),
    kind: 'generation',
    type: 'image',
    referenceCardIds: [],
  } as CanvasCard;
  const doc = {
    cards: [a, b, consumer],
    frames: {},
    organization: createEmptyCanvasOrganization(),
  };
  doc.organization.templateInstances.i = {
    id: 'i',
    templateId: 't',
    templateRevision: 1,
    definitionDigest: 'digest',
    creationRequestHash: 'hash',
    stepCardIds: { s: 'consumer' },
    slotDefinitions: [0, 1].map((order) => ({
      id: `slot${order}`,
      label: `Slot ${order}`,
      mediaType: 'image',
      required: true,
      consumers: [{ stepId: 's', order, role: 'subject' }],
    })),
    slotBindings: {},
    groupIds: [],
    createdAt: '2026-10-20',
  };
  const late = applyCanvasOrganizationOperations(doc, [
    {
      type: 'bind_template_slot',
      instanceId: 'i',
      slotId: 'slot1',
      binding: {
        assetId: 'asset-b',
        referenceCardId: 'b',
        elementId: 'element-b',
        versionId: 'v1',
      },
    },
  ]).document;
  assert.equal(Object.values(late.organization.elementBindings)[0]?.order, 0);
  const first = applyCanvasOrganizationOperations(late, [
    {
      type: 'bind_template_slot',
      instanceId: 'i',
      slotId: 'slot0',
      binding: {
        assetId: 'asset-a',
        referenceCardId: 'a',
        elementId: 'element-a',
        versionId: 'v1',
      },
    },
  ]).document;
  assert.equal(
    Object.values(first.organization.elementBindings).find(
      (binding) => binding.elementId === 'element-b'
    )?.order,
    1
  );
  const unbound = applyCanvasOrganizationOperations(first, [
    { type: 'unbind_template_slot', instanceId: 'i', slotId: 'slot0' },
  ]).document;
  assert.equal(Object.values(unbound.organization.elementBindings).length, 1);
  assert.equal(
    Object.values(unbound.organization.elementBindings)[0].elementId,
    'element-b'
  );
  assert.equal(Object.values(unbound.organization.elementBindings)[0].order, 0);
});
