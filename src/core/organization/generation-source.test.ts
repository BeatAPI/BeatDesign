import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';
import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { emptyOrganizationDocument } from './organization-document';
import { assertCanvasGenerationSourceDocument } from './generation-source';
import {
  captureTemplate,
  instantiateTemplate,
} from '@/core/workflows/workflow-template';

const ref = {
  ...buildTextCard({ id: 'ref', name: 'Character' }),
  kind: 'asset',
  type: 'image',
  assetId: 'asset-a',
  url: '/asset-a',
} as CanvasCard;
const source = {
  ...buildTextCard({ id: 'gen', name: 'Shot' }),
  kind: 'generation',
  type: 'video',
  prompt: 'Move slowly',
  modelId: 'model',
  referenceCardIds: ['ref'],
} as CanvasCard;
const document = { cards: [ref, source], frames: {} };
const request = {
  version: 2 as const,
  projectId: 'project',
  sourceSurface: 'canvas' as const,
  sourceCardId: source.id,
  mode: 'video' as const,
  modelId: 'model',
  prompt: source.prompt,
  references: [{ assetId: 'asset-a', role: 'reference' as const }],
  parameters: {},
};

test('Canvas source verifies precise inputs and returns context independent of display status', () => {
  const first = assertCanvasGenerationSourceDocument(
    document,
    emptyOrganizationDocument(),
    request
  );
  assert.equal(first.sourceCardId, 'gen');
  assert.equal(first.sourceContextDigest.length, 64);
  const changedStatus = {
    ...document,
    cards: [ref, { ...source, status: 'pending' as const }],
  };
  assert.equal(
    assertCanvasGenerationSourceDocument(
      changedStatus,
      emptyOrganizationDocument(),
      request
    ).sourceContextDigest,
    first.sourceContextDigest
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, references: [] }
      ),
    /reference/i
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, prompt: 'Different' }
      ),
    /prompt/i
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, sourceCardId: undefined }
      ),
    /source/i
  );
});

test('source digest changes with reviewed settings and fixed Element versions remain explicit', () => {
  const element = {
    id: 'element',
    name: 'Character',
    kind: 'character' as const,
    description: '',
    currentVersionId: 'version-1',
    deletedAt: null,
    versions: {
      'version-1': {
        id: 'version-1',
        assetId: 'asset-a',
        mediaType: 'image' as const,
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    },
  };
  const binding = {
    id: 'binding',
    consumerCardId: 'gen',
    elementId: 'element',
    versionId: 'version-1',
    assetId: 'asset-a',
    referenceCardId: 'ref',
    order: 0,
    role: 'subject' as const,
    reviewedAgainstCurrentVersionId: 'version-1',
  };
  const bound = {
    ...document,
    organization: { elementBindings: { binding }, templateInstances: {} },
  };
  const organization = {
    ...emptyOrganizationDocument(),
    elements: { element },
  };
  const result = assertCanvasGenerationSourceDocument(
    bound,
    organization,
    request
  );
  assert.equal(result.provenance.elementBindings[0].versionId, 'version-1');
  assert.equal(result.references[0].role, 'subject');
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(bound, organization, {
        ...request,
        references: [{ assetId: 'asset-a', role: 'pose' }],
      }),
    /role/i
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        {
          ...bound,
          organization: {
            ...bound.organization,
            elementBindings: { binding: { ...binding, role: 'audio_track' } },
          },
        },
        organization,
        request
      ),
    /audio/i
  );
  const updated = {
    ...bound,
    cards: [ref, { ...source, duration: '10s' as const }],
  };
  assert.notEqual(
    assertCanvasGenerationSourceDocument(updated, organization, request)
      .sourceContextDigest,
    result.sourceContextDigest
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        bound,
        emptyOrganizationDocument(),
        request
      ),
    /Element/i
  );
});

test('template generation remains blocked before required media binding', () => {
  const definition = captureTemplate(document, ['gen']);
  const created = instantiateTemplate({
    projectId: 'project',
    commandId: 'cmd',
    instanceId: 'instance',
    templateId: 'template',
    templateRevision: 1,
    definition,
    bindings: {},
    placement: { x: 0, y: 0 },
  });
  const doc = {
    cards: created.cards,
    frames: created.frames,
    organization: {
      elementBindings: {},
      templateInstances: { instance: created.instance },
    },
  };
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(doc, emptyOrganizationDocument(), {
        ...request,
        sourceCardId: created.cards[0].id,
        references: [],
      }),
    /Required reference/i
  );
});

test('initial request parameters must match reviewed controls before any intent exists', () => {
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, parameters: { aspect_ratio: '9:16' } }
      ),
    /aspect_ratio.*reviewed/i
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, parameters: { wmDuration: '15s' } }
      ),
    /wmDuration.*reviewed/i
  );
  const result = assertCanvasGenerationSourceDocument(
    document,
    emptyOrganizationDocument(),
    {
      ...request,
      parameters: {
        aspect_ratio: source.aspectRatio,
        wmDuration: source.duration,
      },
    }
  );
  assert.equal(result.parameters.aspect_ratio, source.aspectRatio);
  assert.equal(result.parameters.wmDuration, source.duration);
});

test('source parameter validation permits supported defaults and measured runtime metadata', () => {
  const model = {
    parameterSchema: {
      aspect_ratio: {},
      wmDuration: {},
      max_output_tokens: {},
      sourceVideoDurationSeconds: {},
    },
    defaultParameters: { max_output_tokens: 2048 },
  };
  const result = assertCanvasGenerationSourceDocument(
    document,
    emptyOrganizationDocument(),
    {
      ...request,
      parameters: { max_output_tokens: 2048, sourceVideoDurationSeconds: 3.5 },
    },
    model
  );
  assert.equal(result.parameters.sourceVideoDurationSeconds, 3.5);
  assert.equal(result.parameters.max_output_tokens, 2048);
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, parameters: { max_output_tokens: 9999 } },
        model
      ),
    /max_output_tokens.*reviewed/i
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, parameters: { unknown: true } },
        model
      ),
    /unknown.*reviewed/i
  );
  assert.throws(
    () =>
      assertCanvasGenerationSourceDocument(
        document,
        emptyOrganizationDocument(),
        { ...request, parameters: { sourceVideoDurationSeconds: -1 } },
        model
      ),
    /duration|Duration/i
  );
});
