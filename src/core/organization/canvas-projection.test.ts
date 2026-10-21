import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard } from '../beatcanvas/text-nodes';
import {
  applyCanvasOrganizationOperations,
  createEmptyCanvasOrganization,
} from './canvas-organization';
import { projectCanvasOrganization } from './canvas-projection';
import type { CanvasCard } from '../beatcanvas/canvas-types';

const frame = { x: 0, y: 0, w: 100, h: 100 };
test('eight shot / 140-card fixture projects twelve entries without changing authoritative references', () => {
  const cards = Array.from({ length: 140 }, (_, i) => ({
    ...buildTextCard({
      id: `c${i}`,
      name: `Card ${i}`,
      textContent: '',
      textRole: 'note',
    }),
    referenceCardIds: i < 136 ? ['c136', 'c137'] : [],
  }));
  const operations = Array.from({ length: 8 }, (_, i) => ({
    type: 'create_group' as const,
    groupId: `g${i}`,
    name: `Shot ${i}`,
    role: 'shot' as const,
    memberCardIds: cards.slice(i * 17, i * 17 + 17).map((c) => c.id),
    summaryFrame: { ...frame, x: i * 120 },
    expandedFrame: frame,
    collapsed: true,
  }));
  const doc = applyCanvasOrganizationOperations(
    { cards, frames: {}, organization: createEmptyCanvasOrganization() },
    operations
  ).document;
  const before = JSON.stringify(doc);
  const overview = projectCanvasOrganization(doc);
  assert.equal(overview.nodes.length, 12);
  assert.equal(overview.hiddenCardIds.length, 136);
  const focus = projectCanvasOrganization(doc, { selectedGroupId: 'g0' });
  assert.equal(focus.edges.length, 2);
  assert.equal(focus.edges[0].count, 17);
  assert.equal(JSON.stringify(doc), before);
  const expanded = applyCanvasOrganizationOperations(doc, [
    { type: 'set_group_collapsed', groupId: 'g0', collapsed: false },
  ]).document;
  assert.equal(
    projectCanvasOrganization(expanded).nodes.filter((n) => n.kind === 'card')
      .length,
    21
  );
});

test('cross-group edges aggregate in display only and internal edges disappear on collapse', () => {
  const cards = ['a', 'b', 'c'].map((id) =>
    buildTextCard({ id, name: id, textContent: '', textRole: 'note' })
  );
  cards[1].referenceCardIds = ['a'];
  cards[2].referenceCardIds = ['a', 'b'];
  const doc = applyCanvasOrganizationOperations(
    { cards, frames: {}, organization: createEmptyCanvasOrganization() },
    [
      {
        type: 'create_group',
        groupId: 'g',
        name: 'Shot',
        role: 'shot',
        memberCardIds: ['a', 'b'],
        summaryFrame: frame,
        expandedFrame: frame,
        collapsed: true,
      },
    ]
  ).document;
  const p = projectCanvasOrganization(doc, { showAllReferences: true });
  assert.equal(p.edges.length, 1);
  assert.equal(p.edges[0].count, 2);
  assert.deepEqual(p.edges[0].references, [
    { sourceCardId: 'a', targetCardId: 'c' },
    { sourceCardId: 'b', targetCardId: 'c' },
  ]);
  assert.deepEqual(doc.cards[2].referenceCardIds, ['a', 'b']);
});

test('old-output proxy keeps concrete input snapshots, failed history and collapsed running state', () => {
  const base = buildTextCard({
    id: 'draft',
    name: 'Image',
    textContent: '',
    textRole: 'note',
  });
  const draft = {
    ...base,
    kind: 'generation',
    type: 'image',
    status: 'processing',
    pinnedOutputId: 'new',
  } as CanvasCard;
  const old = {
    ...draft,
    id: 'old',
    kind: 'output',
    status: 'succeeded',
    assetId: 'old-asset',
    sourceConfigCardId: 'draft',
    generationRunId: 'old-run',
    referenceCardIds: ['draft'],
    generationSnapshot: {
      ...draft,
      capturedAt: '2026-10-19T00:00:00Z',
      referenceCardIds: ['exact-reference'],
    },
  } as CanvasCard;
  const failed = { ...old, id: 'failed', status: 'failed' } as CanvasCard;
  const consumer = {
    ...draft,
    id: 'consumer',
    referenceCardIds: ['old'],
    generationSnapshot: undefined,
  } as CanvasCard;
  const doc = applyCanvasOrganizationOperations(
    {
      cards: [draft, old, failed, consumer],
      frames: {},
      organization: createEmptyCanvasOrganization(),
    },
    [
      {
        type: 'create_group',
        groupId: 'g',
        name: 'Shot',
        role: 'shot',
        memberCardIds: ['draft'],
        summaryFrame: frame,
        expandedFrame: frame,
        collapsed: true,
      },
    ]
  ).document;
  const before = structuredClone(doc);
  const projection = projectCanvasOrganization(doc, {
    showAllReferences: true,
  });
  assert.equal(
    projection.nodes.find((n) => n.id === 'g')?.statuses?.processing,
    1
  );
  assert.equal(projection.nodes.find((n) => n.id === 'g')?.statuses?.failed, 1);
  assert.equal(projection.edges[0].source, 'g');
  assert.equal(projection.edges[0].references[0].sourceCardId, 'old');
  assert.deepEqual(doc, before);
  const all = applyCanvasOrganizationOperations(doc, [
    { type: 'set_organization_view', historyMode: 'all' },
  ]).document;
  assert.equal(all.cards.length, 4);
  assert.equal(
    projectCanvasOrganization(all).nodes.some((n) => n.id === 'failed'),
    false,
    'history lives in Takes rather than added media boxes'
  );
  assert.deepEqual(projection.historyGroups, []);
  assert.equal(
    projectCanvasOrganization(all).historyGroups[0].generationCardId,
    'draft'
  );
  assert.deepEqual(
    projectCanvasOrganization(all).historyGroups[0].outputCardIds.sort(),
    ['failed', 'old']
  );
});
