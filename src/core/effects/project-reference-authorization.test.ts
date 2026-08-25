import assert from 'node:assert/strict';
import test from 'node:test';

import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import type { ProjectSnapshotDocument } from '@/core/projects/project-snapshot';
import { resolveAuthorizedProjectReferenceUrls } from './project-reference-authorization';

const card = ({
  id,
  kind,
  url,
}: {
  id: string;
  kind: CanvasCard['kind'];
  url: string | null;
}): CanvasCard =>
  ({
    id,
    assetId: null,
    kind,
    type: 'video',
    name: id,
    url,
    resultText: null,
    prompt: '',
    referenceCardIds: [],
    workflowTemplateId: null,
    status: 'idle',
    error: null,
    modelId: '',
    aspectRatio: '16:9',
    outputQuality: '1k',
    duration: '5s',
    mode: 'quality',
    variant: 'standard',
    quality: 'standard',
    sourceGenerationId: null,
    sourceConfigCardId: null,
    generationRunId: null,
    generationSnapshot: null,
    pinnedOutputId: null,
  }) as CanvasCard;

test('treats saved canvas media as project-authorized generation references', () => {
  const canvasVideo = 'https://media.beatapi.io/inputs/canvas-video.mp4';
  const projectImage = 'https://media.beatapi.io/outputs/project-image.png';
  const unrelated = 'https://attacker.example/unrelated.mp4';
  const snapshot: ProjectSnapshotDocument = {
    version: 3,
    cards: [
      card({ id: 'canvas-video', kind: 'asset', url: canvasVideo }),
      card({ id: 'unused-output', kind: 'output', url: unrelated }),
    ],
    frames: {},
  };

  assert.deepEqual(
    resolveAuthorizedProjectReferenceUrls({
      referencedUrls: [canvasVideo, projectImage],
      projectAssetUrls: [projectImage, projectImage],
      snapshot,
    }),
    [projectImage, canvasVideo]
  );
});

test('does not authorize a URL merely because another canvas URL is trusted', () => {
  const canvasVideo = 'https://media.beatapi.io/inputs/canvas-video.mp4';
  const unknown = 'https://attacker.example/unknown.mp4';
  const snapshot: ProjectSnapshotDocument = {
    version: 3,
    cards: [card({ id: 'canvas-video', kind: 'generation', url: canvasVideo })],
    frames: {},
  };

  assert.deepEqual(
    resolveAuthorizedProjectReferenceUrls({
      referencedUrls: [unknown],
      projectAssetUrls: [],
      snapshot,
    }),
    []
  );
});
