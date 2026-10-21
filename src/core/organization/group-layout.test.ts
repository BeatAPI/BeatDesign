import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard } from '../beatcanvas/text-nodes';
import type { CanvasCard } from '../beatcanvas/canvas-types';
import {
  applyCanvasOrganizationOperations,
  createEmptyCanvasOrganization,
} from './canvas-organization';
import {
  displayedGroupFrame,
  fittedGroupFrame,
  overlaps,
  visibleCardFrame,
  visibleGroupCards,
} from './group-layout';

function fixture() {
  const text = buildTextCard({
    id: 'note',
    name: 'Note',
    textContent: 'saved',
    textRole: 'note',
  });
  const generation = {
    ...text,
    id: 'image',
    kind: 'generation',
    type: 'image',
    status: 'succeeded',
    prompt: 'unchanged',
    pinnedOutputId: 'take6',
  } as CanvasCard;
  const cards = [
    text,
    generation,
    ...Array.from(
      { length: 7 },
      (_, i) =>
        ({
          ...generation,
          id: `take${i}`,
          kind: 'output',
          sourceConfigCardId: 'image',
          assetId: `asset${i}`,
          url: `/media/${i}`,
          generationRunId: `run${i}`,
          generationSnapshot: {
            type: 'image',
            prompt: 'historic',
            referenceCardIds: ['exact'],
            capturedAt: 'now',
          },
        }) as CanvasCard
    ),
  ];
  return applyCanvasOrganizationOperations(
    {
      cards,
      frames: Object.fromEntries(
        cards.map((card, i) => [
          card.id,
          { x: 100, y: 200 + i * 400, w: i === 0 ? 200 : 320, h: 180 },
        ])
      ),
      organization: createEmptyCanvasOrganization(),
    },
    [
      {
        type: 'create_group',
        groupId: 'g',
        name: 'Group',
        role: 'shot',
        memberCardIds: cards.map((card) => card.id),
        summaryFrame: { x: 100, y: 200, w: 340, h: 210 },
        expandedFrame: { x: 100, y: 200, w: 1000, h: 4000 },
      },
    ]
  ).document;
}

for (const mode of ['tidy', 'row', 'column'] as const) {
  test(`${mode} fits visible members including title and Take strip, retains history and is deterministic`, () => {
    const source = fixture();
    const before = structuredClone(source);
    const arranged = applyCanvasOrganizationOperations(source, [
      { type: 'layout_group', groupId: 'g', mode },
    ]).document;
    const group = arranged.organization.groups.g;
    const members = visibleGroupCards(arranged, group).map(
      (card) => visibleCardFrame(arranged, card)!
    );
    assert.equal(members.length, 2);
    assert.equal(overlaps(members[0], members[1]), false);
    for (const bounds of members) {
      assert.ok(bounds.y >= group.expandedFrame.y + 112);
      assert.ok(
        bounds.x + bounds.w <=
          group.expandedFrame.x + group.expandedFrame.w - 24
      );
      assert.ok(
        bounds.y + bounds.h <=
          group.expandedFrame.y + group.expandedFrame.h - 24
      );
    }
    assert.ok(
      group.expandedFrame.h < 1000,
      'hidden outputs do not create an oversized empty group'
    );
    assert.deepEqual(arranged.cards, before.cards);
    const delta = {
      x: arranged.frames.image.x - before.frames.image.x,
      y: arranged.frames.image.y - before.frames.image.y,
    };
    assert.equal(arranged.frames.take0.x - before.frames.take0.x, delta.x);
    assert.equal(arranged.frames.take0.y - before.frames.take0.y, delta.y);
    assert.deepEqual(source, before, 'input document stays untouched');
    assert.deepEqual(
      applyCanvasOrganizationOperations(arranged, [
        { type: 'layout_group', groupId: 'g', mode },
      ]).document,
      arranged
    );
  });
}

test('display bounds grow around visible content without changing canonical positions; fit only changes group bounds', () => {
  const source = fixture();
  source.organization.groups.g.expandedFrame = {
    x: 100,
    y: 200,
    w: 100,
    h: 100,
  };
  const before = structuredClone(source);
  const frame = displayedGroupFrame(source, source.organization.groups.g);
  assert.ok(frame.y < 200);
  assert.ok(frame.w >= 320);
  assert.deepEqual(source, before);
  const fitted = applyCanvasOrganizationOperations(source, [
    { type: 'fit_group', groupId: 'g' },
  ]).document;
  assert.deepEqual(fitted.frames, source.frames);
  assert.deepEqual(fitted.cards, source.cards);
  assert.deepEqual(
    fitted.organization.groups.g.expandedFrame,
    fittedGroupFrame(source, source.organization.groups.g)
  );
});

for (const mode of ['tidy', 'row', 'column'] as const) {
  test(`${mode} separates different-sized groups and avoids unrelated cards without rewriting sources`, () => {
    let source = fixture();
    source = applyCanvasOrganizationOperations(source, [
      { type: 'layout_group', groupId: 'g', mode: 'row' },
    ]).document;
    for (let i = 1; i < 4; i++) {
      const card = { ...source.cards[0], id: `outside${i}` } as CanvasCard;
      source.cards.push(card);
      source.frames[card.id] = { x: 150, y: 220, w: 120 + i * 100, h: 100 };
      source = applyCanvasOrganizationOperations(source, [
        {
          type: 'create_group',
          groupId: `g${i}`,
          name: `Group ${i}`,
          role: 'shot',
          memberCardIds: [card.id],
          summaryFrame: { x: 150, y: 220, w: 340, h: 210 },
          expandedFrame: { x: 150, y: 220, w: 400 + i * 100, h: 400 },
        },
      ]).document;
    }
    source.cards.push({ ...source.cards[0], id: 'support' } as CanvasCard);
    source.frames.support = { x: 100, y: 700, w: 700, h: 300 };
    const before = structuredClone(source);
    const operation = {
      type: 'arrange_groups' as const,
      groupIds: ['g', 'g1', 'g2', 'g3'],
      mode,
    };
    const arranged = applyCanvasOrganizationOperations(source, [
      operation,
    ]).document;
    const bounds = operation.groupIds.map((id) =>
      displayedGroupFrame(arranged, arranged.organization.groups[id])
    );
    bounds.forEach((frame, i) => {
      assert.equal(overlaps(frame, arranged.frames.support), false);
      bounds
        .slice(i + 1)
        .forEach((other) => assert.equal(overlaps(frame, other), false));
    });
    assert.deepEqual(arranged.frames.support, before.frames.support);
    assert.deepEqual(arranged.cards, before.cards);
    assert.equal(
      Object.keys(arranged.frames).length,
      Object.keys(before.frames).length
    );
    assert.deepEqual(source, before);
    assert.deepEqual(
      applyCanvasOrganizationOperations(arranged, [operation]).document,
      arranged
    );
  });
}

test('layout rejects unknown groups, duplicate groups and unsaved member bounds atomically', () => {
  const source = fixture(),
    before = structuredClone(source);
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(source, [
        { type: 'arrange_groups', groupIds: ['g', 'missing'], mode: 'row' },
      ]),
    /Unknown group/
  );
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(source, [
        { type: 'arrange_groups', groupIds: ['g', 'g'], mode: 'row' },
      ]),
    /unique/
  );
  delete source.frames.note;
  assert.throws(
    () =>
      applyCanvasOrganizationOperations(source, [
        { type: 'layout_group', groupId: 'g', mode: 'row' },
      ]),
    /Save member positions/
  );
  assert.deepEqual(source.cards, before.cards);
});

test('implicit history follows its step while a visible analysis report is arranged only once', () => {
  const source = fixture();
  source.organization.groups.g.memberCardIds = ['note', 'image'];
  source.cards[1] = {
    ...source.cards[1],
    generationMode: 'analysis',
  } as CanvasCard;
  const report = source.cards.find((card) => card.id === 'take0')!;
  report.generationSnapshot = {
    ...report.generationSnapshot!,
    generationMode: 'analysis',
  };
  const arranged = applyCanvasOrganizationOperations(source, [
    { type: 'layout_group', groupId: 'g', mode: 'row' },
  ]).document;
  const members = visibleGroupCards(
    arranged,
    arranged.organization.groups.g
  ).map((card) => visibleCardFrame(arranged, card)!);
  assert.equal(members.length, 3);
  members.forEach((frame, i) =>
    members
      .slice(i + 1)
      .forEach((other) => assert.equal(overlaps(frame, other), false))
  );
  assert.equal(
    arranged.frames.take1.x - source.frames.take1.x,
    arranged.frames.image.x - source.frames.image.x
  );
  assert.deepEqual(arranged.cards, source.cards);
});

test('arranging one selected group leaves an unselected group and its explicit output untouched', () => {
  let source = fixture();
  source.organization.groups.g.memberCardIds = ['note', 'image'];
  source = applyCanvasOrganizationOperations(source, [
    {
      type: 'create_group',
      groupId: 'other',
      name: 'Other',
      role: 'shot',
      memberCardIds: ['take0'],
      summaryFrame: { x: 100, y: 200, w: 340, h: 210 },
      expandedFrame: { x: 100, y: 200, w: 500, h: 500 },
    },
  ]).document;
  const before = structuredClone(source);
  const arranged = applyCanvasOrganizationOperations(source, [
    { type: 'arrange_groups', groupIds: ['g'], mode: 'row' },
  ]).document;
  assert.deepEqual(
    arranged.organization.groups.other,
    before.organization.groups.other
  );
  assert.deepEqual(arranged.frames.take0, before.frames.take0);
  assert.equal(
    overlaps(
      displayedGroupFrame(arranged, arranged.organization.groups.g),
      displayedGroupFrame(arranged, arranged.organization.groups.other)
    ),
    false
  );
});
