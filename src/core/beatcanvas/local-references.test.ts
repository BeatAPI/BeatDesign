import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard, CanvasDraftCard } from './canvas-types';
import {
  getPendingDraftReferenceUploadCount,
  isLocalWorkspaceMediaUrl,
  promotePendingDraftReferenceUploads,
} from './local-references';

const draft = {
  id: 'draft-1',
  kind: 'generation',
  type: 'image',
  referenceCardIds: ['character-card', 'outfit-05', 'bg-05'],
} as CanvasDraftCard;

const localCard = (id: string, url: string): CanvasCard =>
  ({
    id,
    kind: 'asset',
    type: 'image',
    name: id,
    url,
    assetId: null,
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
  }) satisfies CanvasCard;

test('counts same-origin demo assets as just-in-time uploads', () => {
  assert.equal(
    getPendingDraftReferenceUploadCount({
      draftCard: draft,
      cardsById: {
        'character-card': localCard(
          'character-card',
          '/demo-assets/character.png'
        ),
        'outfit-05': localCard('outfit-05', '/demo-assets/outfit.png'),
        'bg-05': localCard('bg-05', '/demo-assets/bg.png'),
      },
      pendingUploadsByCardId: {},
    }),
    3
  );
  assert.equal(isLocalWorkspaceMediaUrl('/demo-assets/character.png'), true);
  assert.equal(
    isLocalWorkspaceMediaUrl('https://media.beatapi.io/inputs/file.png'),
    false
  );
});

test('uploads local demo assets through the generation intent', async () => {
  const uploaded: string[] = [];
  const promotions = await promotePendingDraftReferenceUploads({
    draftCard: draft,
    cardsById: {
      'character-card': localCard(
        'character-card',
        '/demo-assets/character.png'
      ),
      'outfit-05': localCard('outfit-05', '/demo-assets/outfit.png'),
      'bg-05': localCard('bg-05', 'https://media.beatapi.io/keep.png'),
    },
    pendingUploadsByCardId: {},
    projectId: 'project-1',
    generationIntentToken: 'intent-1',
    fetchImpl: async (input) =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    uploadFileFromBrowserImpl: async (file) => {
      uploaded.push(file.name);
      return { url: `https://media.beatapi.io/${file.name}`, key: file.name };
    },
  });

  assert.deepEqual(uploaded, ['character.png', 'outfit.png']);
  assert.equal(promotions.length, 2);
  assert.equal(
    promotions[0]?.uploadResult.url,
    'https://media.beatapi.io/character.png'
  );
});
