import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  applyOrganizationOperations,
  emptyOrganizationDocument,
  normalizeOrganizationDocument,
  organizationOperationSchema,
  previewFolderRemoval,
} from './organization-document';

const assets = new Map([
  ['image', { type: 'image' }],
  ['image2', { type: 'image' }],
  ['voice', { type: 'audio' }],
  ['video', { type: 'video' }],
]);
const now = '2026-10-20T00:00:00.000Z';
const options = { assets, now, revision: 4 };
const folder = (
  folderId: string,
  name = folderId,
  parentId: string | null = null
) => ({ type: 'create_folder' as const, folderId, name, parentId });
const element = {
  type: 'create_element' as const,
  elementId: 'lulu',
  name: 'Lulu',
  kind: 'character' as const,
  description: '',
  versionId: 'v1',
  assetId: 'image',
};

test('organization operations expose concrete MCP-compatible JSON Schema', () => {
  const schema = JSON.stringify(z.toJSONSchema(organizationOperationSchema));
  assert.match(schema, /create_folder/);
  assert.match(schema, /set_element_current/);
});

test('empty old organization is read-only and unknown versions/fields are rejected', () => {
  assert.deepEqual(
    normalizeOrganizationDocument(null),
    emptyOrganizationDocument()
  );
  assert.throws(() =>
    normalizeOrganizationDocument({
      ...emptyOrganizationDocument(),
      version: 2,
    })
  );
  assert.throws(() =>
    normalizeOrganizationDocument({
      ...emptyOrganizationDocument(),
      secret: 'x',
    })
  );
  assert.equal(
    organizationOperationSchema.safeParse({
      ...folder('a'),
      path: 'D:/private',
    }).success,
    false
  );
  assert.equal(
    organizationOperationSchema.safeParse(folder('__proto__')).success,
    false
  );
  assert.throws(() =>
    normalizeOrganizationDocument({
      ...emptyOrganizationDocument(),
      folders: {
        a: { id: 'a', name: 'One', parentId: null },
        ' a': { id: 'a', name: 'Two', parentId: null },
      },
    })
  );
});

test('folders normalize names, preserve inputs and replay stable IDs without changes', () => {
  const original = emptyOrganizationDocument();
  const result = applyOrganizationOperations(
    original,
    [
      folder('root', '  Café  '),
      folder('child', 'Child', 'root'),
      {
        type: 'assign_assets',
        assetIds: ['image', 'image'],
        folderId: 'child',
      },
    ],
    options
  );
  assert.equal(result.document.folders.root.name, 'Café');
  assert.deepEqual(result.document.assetLocations, { image: 'child' });
  assert.deepEqual(original, emptyOrganizationDocument());
  const replay = applyOrganizationOperations(
    result.document,
    [folder('root', 'Café')],
    options
  );
  assert.deepEqual(replay.changedIds, []);
  assert.throws(() =>
    applyOrganizationOperations(
      result.document,
      [folder('root', 'Other')],
      options
    )
  );
});

test('folder invariants reject normalized same-parent names, cycles, depth and foreign assets atomically', () => {
  assert.throws(() =>
    applyOrganizationOperations(
      emptyOrganizationDocument(),
      [folder('a', 'Café'), folder('b', 'CAFE\u0301')],
      options
    )
  );
  const doc = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [folder('a'), folder('b', 'b', 'a')],
    options
  ).document;
  assert.throws(() =>
    applyOrganizationOperations(
      doc,
      [{ type: 'move_folder', folderId: 'a', parentId: 'b' }],
      options
    )
  );
  assert.throws(() =>
    applyOrganizationOperations(
      doc,
      [{ type: 'assign_assets', assetIds: ['foreign'], folderId: 'a' }],
      options
    )
  );
  assert.throws(() =>
    applyOrganizationOperations(
      doc,
      [{ type: 'assign_assets', assetIds: ['image'], folderId: 'missing' }],
      options
    )
  );
  assert.equal(doc.folders.a.parentId, null);
  const deep = Array.from({ length: 10 }, (_, i) =>
    folder(`d${i}`, `d${i}`, i ? `d${i - 1}` : null)
  );
  assert.throws(() =>
    applyOrganizationOperations(emptyOrganizationDocument(), deep, options)
  );
});

test('folder removal previews and promotes files/children; stale previews and collisions refuse', () => {
  const doc = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [
      folder('a'),
      folder('b', 'b', 'a'),
      folder('c', 'c', 'b'),
      { type: 'assign_assets', assetIds: ['image'], folderId: 'b' },
    ],
    options
  ).document;
  assert.deepEqual(previewFolderRemoval(doc, 'b', 4), {
    organizationRevision: 4,
    folderId: 'b',
    parentId: 'a',
    assetIds: ['image'],
    childFolderIds: ['c'],
    conflicts: [],
  });
  assert.throws(() =>
    applyOrganizationOperations(
      doc,
      [{ type: 'remove_folder', folderId: 'b', previewRevision: 3 }],
      options
    )
  );
  assert.throws(() =>
    applyOrganizationOperations(
      doc,
      [{ type: 'remove_folder', folderId: 'b', previewRevision: 4 }],
      { assets }
    )
  );
  const removed = applyOrganizationOperations(
    doc,
    [{ type: 'remove_folder', folderId: 'b', previewRevision: 4 }],
    options
  ).document;
  assert.equal(removed.assetLocations.image, 'a');
  assert.equal(removed.folders.c.parentId, 'a');
  const conflict = applyOrganizationOperations(
    doc,
    [folder('other', 'c', 'a')],
    options
  ).document;
  assert.equal(previewFolderRemoval(conflict, 'b', 4).conflicts.length, 1);
  assert.throws(() =>
    applyOrganizationOperations(
      conflict,
      [{ type: 'remove_folder', folderId: 'b', previewRevision: 4 }],
      options
    )
  );
  const root = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [
      folder('root'),
      { type: 'assign_assets', assetIds: ['image'], folderId: 'root' },
    ],
    options
  ).document;
  assert.deepEqual(
    applyOrganizationOperations(
      root,
      [{ type: 'remove_folder', folderId: 'root', previewRevision: 4 }],
      options
    ).document.assetLocations,
    {}
  );
});

test('final-state validation supports swapping sibling folder names within one atomic batch', () => {
  const doc = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [folder('a', 'A'), folder('b', 'B')],
    options
  ).document;
  const result = applyOrganizationOperations(
    doc,
    [
      { type: 'rename_folder', folderId: 'a', name: 'B' },
      { type: 'rename_folder', folderId: 'b', name: 'A' },
    ],
    options
  ).document;
  assert.equal(result.folders.a.name, 'B');
});

test('Element versions are immutable, exactly typed and current selection never rewrites earlier versions', () => {
  const initial = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [element],
    options
  ).document;
  assert.deepEqual(
    applyOrganizationOperations(initial, [element], {
      ...options,
      now: '2026-10-21T00:00:00.000Z',
    }).changedIds,
    []
  );
  const next = applyOrganizationOperations(
    initial,
    [
      {
        type: 'add_element_version',
        elementId: 'lulu',
        versionId: 'v2',
        assetId: 'image2',
      },
      { type: 'set_element_current', elementId: 'lulu', versionId: 'v2' },
    ],
    options
  ).document;
  assert.deepEqual(
    next.elements.lulu.versions.v1,
    initial.elements.lulu.versions.v1
  );
  assert.equal(initial.elements.lulu.currentVersionId, 'v1');
  assert.equal(next.elements.lulu.currentVersionId, 'v2');
  assert.throws(() =>
    applyOrganizationOperations(
      next,
      [
        {
          type: 'add_element_version',
          elementId: 'lulu',
          versionId: 'v1',
          assetId: 'image2',
        },
      ],
      options
    )
  );
  assert.throws(() =>
    applyOrganizationOperations(
      next,
      [
        {
          type: 'set_element_current',
          elementId: 'lulu',
          versionId: 'missing',
        },
      ],
      options
    )
  );
  assert.throws(() =>
    applyOrganizationOperations(
      emptyOrganizationDocument(),
      [{ ...element, assetId: 'voice' }],
      options
    )
  );
  assert.throws(() =>
    applyOrganizationOperations(
      emptyOrganizationDocument(),
      [{ ...element, kind: 'voice', assetId: 'video' }],
      options
    )
  );
});

test('used Elements cannot be removed; soft removal and restoration retain all history', () => {
  const initial = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [element],
    options
  ).document;
  assert.throws(
    () =>
      applyOrganizationOperations(
        initial,
        [{ type: 'remove_element', elementId: 'lulu' }],
        {
          ...options,
          consumers: [{ elementId: 'lulu', consumerCardId: 'shot1' }],
        }
      ),
    /shot1/
  );
  const removed = applyOrganizationOperations(
    initial,
    [{ type: 'remove_element', elementId: 'lulu' }],
    options
  ).document;
  assert.equal(removed.elements.lulu.deletedAt, now);
  assert.deepEqual(
    removed.elements.lulu.versions,
    initial.elements.lulu.versions
  );
  assert.throws(() =>
    applyOrganizationOperations(
      removed,
      [{ type: 'set_element_current', elementId: 'lulu', versionId: 'v1' }],
      options
    )
  );
  const restored = applyOrganizationOperations(
    removed,
    [{ type: 'restore_element', elementId: 'lulu' }],
    options
  ).document;
  assert.equal(restored.elements.lulu.deletedAt, null);
});

test('strict document normalization rejects dangling folders, version pointers and excess capacity', () => {
  assert.throws(() =>
    normalizeOrganizationDocument({
      ...emptyOrganizationDocument(),
      assetLocations: { image: 'missing' },
    })
  );
  const doc = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [element],
    options
  ).document;
  doc.elements.lulu.currentVersionId = 'missing';
  assert.throws(() => normalizeOrganizationDocument(doc));
  assert.throws(() =>
    applyOrganizationOperations(
      emptyOrganizationDocument(),
      Array.from({ length: 501 }, (_, i) => folder(`f${i}`)),
      options
    )
  );
});

test('multiple Element consumers are reported without deletion and same-version replay is a no-op', () => {
  const doc = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [
      element,
      {
        type: 'add_element_version',
        elementId: 'lulu',
        versionId: 'v2',
        assetId: 'image2',
      },
    ],
    options
  ).document;
  assert.deepEqual(
    applyOrganizationOperations(
      doc,
      [
        {
          type: 'add_element_version',
          elementId: 'lulu',
          versionId: 'v2',
          assetId: 'image2',
        },
      ],
      options
    ).changedIds,
    []
  );
  try {
    applyOrganizationOperations(
      doc,
      [{ type: 'remove_element', elementId: 'lulu' }],
      {
        ...options,
        consumers: [
          { elementId: 'lulu', consumerCardId: 'shot1' },
          { elementId: 'lulu', consumerCardId: 'shot2' },
        ],
      }
    );
    assert.fail('Expected a used Element to be protected');
  } catch (error) {
    assert.deepEqual((error as { consumers?: string[] }).consumers, [
      'shot1',
      'shot2',
    ]);
  }
  assert.equal(doc.elements.lulu.deletedAt, null);
});

test('missing historical assets remain explainable during folder edits, but cannot become new current inputs', () => {
  const doc = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [element],
    options
  ).document;
  const unavailable = new Map<string, { type: string }>();
  assert.doesNotThrow(() =>
    applyOrganizationOperations(doc, [folder('a')], { assets: unavailable })
  );
  assert.throws(() =>
    applyOrganizationOperations(
      doc,
      [{ type: 'set_element_current', elementId: 'lulu', versionId: 'v1' }],
      { assets: unavailable }
    )
  );
});

test('capacity guards reject excess folders, versions and serialized size without truncation', () => {
  const tooMany = emptyOrganizationDocument();
  for (let i = 0; i < 501; i++)
    tooMany.folders[`f${i}`] = { id: `f${i}`, name: `f${i}`, parentId: null };
  assert.throws(() => normalizeOrganizationDocument(tooMany), /500/);
  const doc = applyOrganizationOperations(
    emptyOrganizationDocument(),
    [element],
    options
  ).document;
  for (let i = 0; i < 101; i++)
    doc.elements.lulu.versions[`v${i}`] = {
      id: `v${i}`,
      assetId: 'image',
      mediaType: 'image',
      createdAt: now,
    };
  assert.throws(() => normalizeOrganizationDocument(doc), /100/);
  const oversized = emptyOrganizationDocument();
  for (let i = 0; i < 256; i++) {
    const elementId = `e${i}`;
    oversized.elements[elementId] = {
      id: elementId,
      name: elementId,
      kind: 'character',
      description: 'x'.repeat(2000),
      currentVersionId: 'v0',
      deletedAt: null,
      versions: {},
    };
    for (let j = 0; j < 100; j++)
      oversized.elements[elementId].versions[`v${j}`] = {
        id: `v${j}`,
        assetId: 'image',
        mediaType: 'image',
        createdAt: now,
      };
  }
  assert.throws(() => normalizeOrganizationDocument(oversized), /2 MiB/);
});
