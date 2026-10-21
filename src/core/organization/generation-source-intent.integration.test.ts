import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { after, test } from 'node:test';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';
import type { CanvasCard } from '@/core/beatcanvas/canvas-types';

const directory = await mkdtemp(
  join(tmpdir(), 'beatdesign-source-intent-test-')
);
process.env.BEATDESIGN_DATA_DIR = directory;
execFileSync(
  process.execPath,
  ['node_modules/drizzle-kit/bin.cjs', 'push', '--force'],
  { env: process.env, stdio: 'pipe', windowsHide: true }
);
const { createProject, loadProjectWithLatestSnapshot, saveProjectSnapshot } =
  await import('@/core/projects/projects');
const { createEmptyProjectSnapshot } =
  await import('@/core/projects/project-snapshot');
const { getActiveGenerationProvider } =
  await import('@/core/generation-providers/registry');
const {
  createAssetFirstGenerationIntent,
  submitAssetFirstGeneration,
  preflightAssetFirstGeneration,
} = await import('@/core/generation-providers/submit');
const { getGenerationUploadIntentSourceContext } =
  await import('@/core/effects/generation-upload-intent');
const provider = getActiveGenerationProvider();
const configured = provider.assertConfigured;
const createAdapter = provider.createAdapter;
let adapterCalls = 0;
provider.assertConfigured = async () => {};
provider.createAdapter = () => {
  adapterCalls++;
  throw new Error('No provider calls permitted in source-intent fixture.');
};
after(async () => {
  provider.assertConfigured = configured;
  provider.createAdapter = createAdapter;
  const { getDb } = await import('@/core/workspace-lib/db-adapter');
  (await getDb()).$client.close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
});

test('stale Canvas precheck and omission of source identity reject before provider dispatch', async () => {
  const project = await createProject({
    name: 'Synthetic source intent fixture',
  });
  const state = await loadProjectWithLatestSnapshot({ projectId: project.id });
  const card = {
    ...buildTextCard({ id: 'source', name: 'Synthetic draft' }),
    kind: 'generation',
    type: 'image',
    modelId: 'nano-banana',
    prompt: 'Synthetic fixture',
  } as CanvasCard;
  const document = { ...createEmptyProjectSnapshot(), cards: [card] };
  await saveProjectSnapshot({
    projectId: project.id,
    document,
    baseVersion: state!.snapshotVersion,
  });
  const request = {
    version: 2,
    projectId: project.id,
    sourceSurface: 'canvas',
    sourceCardId: card.id,
    mode: 'image',
    modelId: card.modelId,
    prompt: card.prompt,
    references: [],
    parameters: { aspect_ratio: '1:1' },
  };
  await assert.rejects(
    () =>
      createAssetFirstGenerationIntent({
        ...request,
        parameters: { aspect_ratio: '9:16' },
      }),
    /aspect_ratio.*reviewed/i
  );
  assert.equal(adapterCalls, 0);
  const intent = await createAssetFirstGenerationIntent(request);
  assert.equal(
    (
      await getGenerationUploadIntentSourceContext({
        intentId: intent,
        projectId: project.id,
      })
    )?.sourceCardId,
    card.id
  );
  const before = await loadProjectWithLatestSnapshot({ projectId: project.id });
  await saveProjectSnapshot({
    projectId: project.id,
    document: { ...document, cards: [{ ...card, duration: '10s' }] },
    baseVersion: before!.snapshotVersion,
  });
  await assert.rejects(
    () =>
      submitAssetFirstGeneration({
        generation: request,
        origin: 'ui',
        generationIntentId: intent,
      }),
    /changed after precheck/
  );
  const { sourceCardId: _, sourceSurface: __, ...standalone } = request;
  await assert.rejects(
    () =>
      submitAssetFirstGeneration({
        generation: standalone,
        origin: 'ui',
        generationIntentId: intent,
      }),
    /changed after precheck/
  );
  await assert.rejects(
    () =>
      preflightAssetFirstGeneration({ ...request, sourceCardId: undefined }),
    /sourceCardId/
  );
  assert.equal(adapterCalls, 0);
});
