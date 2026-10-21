import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProject,
  loadProjectWithLatestSnapshot,
} from '@/core/projects/projects';
import { persistLocalProjectAsset } from '@/core/projects/local-project-assets';
import {
  recordUserAsset,
  linkProjectAsset,
} from '@/core/workspace-lib/assets/user-assets';
import { persistBeatDesignCommand } from '@/core/commands/persist';
import { canvasCardSchema } from '@/core/commands/schema';
import { timelineCanvasCardId } from '@/core/commands/canvas-commands';
import { loadProjectTimeline } from '@/core/editor/timeline-state';
import { projectCanvasOrganization } from '@/core/organization/canvas-projection';
import { getTimelineUsage } from '@/core/editor/timeline-usage';
import { getDb } from '@/core/workspace-lib/db-adapter';
import type { CanvasOperation } from '@/core/commands/canvas-commands';
import type { EditorOperation } from '@/core/commands/editor-commands';

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR42mPQ96slCTGMahgUGgD8sYyh+gdn4AAAAABJRU5ErkJggg==',
  'base64'
);
function silence() {
  const bytes = Buffer.alloc(1644);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}

/** Synthetic-only demonstration. Never defaults to a user's active data directory. */
export async function seedOrganizationFixture() {
  const configured = process.env.BEATDESIGN_DATA_DIR?.trim();
  if (!configured || resolve(configured) === resolve('data'))
    throw new Error(
      'Set BEATDESIGN_DATA_DIR to an explicitly isolated fixture/preview directory.'
    );
  const directory = resolve(configured);
  await mkdir(directory, { recursive: true });
  const project = await createProject({
    name: 'Canvas organization · 8 shot synthetic preview',
  });
  const target = await createProject({
    name: 'Template binding · isolated target',
  });
  const assetIds: string[] = [];
  const assetUrls = new Map<string, string>();
  const hashes: Record<string, string> = {};
  async function asset(
    index: string,
    type: 'image' | 'video' | 'audio',
    bytes: Buffer
  ) {
    const assetId = `${project.id}-${index}`;
    const suffix = type === 'image' ? 'png' : type === 'video' ? 'mp4' : 'wav';
    const mimeType =
      type === 'image'
        ? 'image/png'
        : type === 'video'
          ? 'video/mp4'
          : 'audio/wav';
    const persisted = await persistLocalProjectAsset({
      projectId: project.id,
      assetId,
      filename: `Synthetic-${index}.${suffix}`,
      mimeType,
      bytes,
    });
    await recordUserAsset({
      id: assetId,
      type,
      source: 'upload',
      bucket: 'local-project-assets',
      objectKey: persisted.objectKey,
      publicUrl: persisted.publicUrl,
      filename: persisted.filename,
      mimeType,
      sizeBytes: persisted.sizeBytes,
      sha256: persisted.sha256,
      storageProvider: 'local',
      originProjectId: project.id,
      metadata: { syntheticFixture: true },
      ...(type === 'image'
        ? { width: 16, height: 9 }
        : { durationMs: type === 'audio' ? 100 : 1000 }),
    });
    await linkProjectAsset({ projectId: project.id, assetId, role: 'upload' });
    assetIds.push(assetId);
    assetUrls.set(assetId, persisted.publicUrl);
    hashes[assetId] = persisted.sha256;
    return assetId;
  }
  const images: string[] = [];
  for (let i = 0; i < 502; i++)
    images.push(
      await asset(`image-${String(i).padStart(3, '0')}`, 'image', pixel)
    );
  const videoBytes = await readFile(resolve('tests/fixtures/tiny-black.mp4'));
  const oldVideo = await asset('video-old', 'video', videoBytes);
  const newVideo = await asset('video-new', 'video', videoBytes);
  const voice = await asset('voice', 'audio', silence());
  // Multiple classifications exercise distinct Asset identity rather than membership identity.
  await linkProjectAsset({
    projectId: project.id,
    assetId: images[0],
    role: 'reference',
  });
  const editorOperations: EditorOperation[] = [];
  for (let shot = 1; shot <= 8; shot++) {
    const clipId = `shot-${shot}-clip`;
    const baseAssetId = shot === 1 ? oldVideo : newVideo;
    editorOperations.push(
      {
        type: 'add_clip',
        clipId,
        assetId: baseAssetId,
        sourceUrl: assetUrls.get(baseAssetId)!,
        name: `Shot ${shot}`,
        sourceType: 'video',
        sourceDuration: 1,
        startTime: (shot - 1) * 0.2,
      },
      {
        type: 'add_take',
        clipId,
        take: {
          id: `shot-${shot}-old-take`,
          assetId: oldVideo,
          sourceUrl: assetUrls.get(oldVideo)!,
          name: 'Earlier chosen take',
          sourceDuration: 1,
          sourceGenerationId: null,
          prompt: 'Synthetic fixture; no model job',
          createdAt: '2026-10-20T00:00:00.000Z',
        },
      },
      { type: 'trim_clip', clipId, inPoint: 0.1, outPoint: 0.3 }
    );
    if (shot > 1)
      editorOperations.push({
        type: 'activate_take',
        clipId,
        takeId: `shot-${shot}-old-take`,
      });
  }
  const edit = await persistBeatDesignCommand({
    projectId: project.id,
    origin: 'system',
    commandId: `fixture-editor-${project.id}`,
    command: { type: 'editor.apply', operations: editorOperations },
  });
  if (!edit.ok) throw new Error(edit.message);
  const timeline = (await loadProjectTimeline(project.id))!;
  const timelineCardId = timelineCanvasCardId(timeline.document.id);
  const canvasOperations: CanvasOperation[] = [];
  const support = [
    {
      id: 'support-character',
      name: 'Shared character',
      type: 'image' as const,
      assetId: images[0],
    },
    {
      id: 'support-location',
      name: 'Shared location',
      type: 'image' as const,
      assetId: images[1],
    },
    {
      id: 'support-voice',
      name: 'Shared voice',
      type: 'audio' as const,
      assetId: voice,
    },
  ];
  for (let i = 0; i < support.length; i++)
    canvasOperations.push({
      type: 'upsert_card',
      card: canvasCardSchema.parse({
        ...support[i],
        kind: 'asset',
        aspectRatio: '16:9',
        url: assetUrls.get(support[i].assetId),
      }),
      frame: { x: 180 + i * 390, y: 850, w: 320, h: 180 },
    });
  canvasOperations.push({
    type: 'upsert_timeline_node',
    timelineId: timeline.document.id,
    name: 'Actual Timeline usage',
    durationSec: timeline.document.duration,
    clipCount: 8,
  });
  for (let shot = 1; shot <= 8; shot++) {
    const prefix = `shot-${shot}`;
    const x = 180 + ((shot - 1) % 4) * 390;
    const y = 160 + Math.floor((shot - 1) / 4) * 310;
    const memberCardIds: string[] = [];
    const script = canvasCardSchema.parse({
      id: `${prefix}-script`,
      kind: 'text',
      type: 'text',
      name: `Shot ${shot} intention`,
      textContent:
        'Synthetic motion and composition example. No story adaptation or model generation.',
      textRole: 'storyboard',
    });
    const image = canvasCardSchema.parse({
      id: `${prefix}-image`,
      kind: 'generation',
      type: 'image',
      name: `Shot ${shot} composition`,
      modelId: 'gpt-image-2.5-flare',
      prompt: 'Synthetic blue frame',
      referenceCardIds: ['support-character', 'support-location', script.id],
      pinnedOutputId: `${prefix}-image-output-6`,
    });
    const motion = canvasCardSchema.parse({
      id: `${prefix}-motion`,
      kind: 'generation',
      type: 'video',
      name: `Shot ${shot} motion`,
      modelId: 'seedance-2.0',
      prompt: 'Synthetic motion fixture',
      referenceCardIds: [`${prefix}-image-output-6`, 'support-character'],
      pinnedOutputId: `${prefix}-video-output-6`,
    });
    const cards = [script, image, motion];
    for (const source of [image, motion])
      for (let take = 0; take < 7; take++) {
        const media =
          source.type === 'image'
            ? images[2 + take]
            : take === 0
              ? oldVideo
              : newVideo;
        cards.push(
          canvasCardSchema.parse({
            ...source,
            id: `${prefix}-${source.type}-output-${take}`,
            kind: 'output',
            name: `Shot ${shot} ${source.type} take ${take + 1}`,
            assetId: media,
            url: assetUrls.get(media),
            sourceConfigCardId: source.id,
            generationRunId: `synthetic-${prefix}-${source.type}-${take}`,
            status: 'succeeded',
            generationSnapshot: {
              type: source.type,
              prompt: source.prompt,
              referenceCardIds: source.referenceCardIds,
              modelId: source.modelId,
              capturedAt: `2026-10-20T00:00:0${take}.000Z`,
            },
          })
        );
      }
    for (let i = 0; i < cards.length; i++) {
      memberCardIds.push(cards[i].id);
      canvasOperations.push({
        type: 'upsert_card',
        card: cards[i],
        frame: {
          x: x + (i % 3) * 350,
          y: y + Math.floor(i / 3) * 220,
          w: 320,
          h: 180,
        },
      });
    }
    canvasOperations.push({
      type: 'create_group',
      groupId: prefix,
      name: `Shot ${String(shot).padStart(2, '0')}`,
      role: 'shot',
      memberCardIds,
      collapsed: true,
      resultCardId: motion.id,
      summaryFrame: { x, y, w: 340, h: 210 },
      expandedFrame: { x, y, w: 1060, h: 1360 },
    });
  }
  // Keep the standalone Timeline entry aligned with the other shared controls.
  canvasOperations.push({
    type: 'move_card',
    cardId: timelineCardId,
    frame: { x: 1350, y: 850, w: 320, h: 180 },
  });
  const canvas = await persistBeatDesignCommand({
    projectId: project.id,
    origin: 'system',
    commandId: `fixture-canvas-${project.id}`,
    idempotencyKey: `fixture-canvas-${project.id}`,
    expectedRevision: 1,
    command: { type: 'canvas.apply', operations: canvasOperations },
  });
  if (!canvas.ok) throw new Error(canvas.message);
  const organized = await persistBeatDesignCommand({
    projectId: project.id,
    origin: 'system',
    commandId: `fixture-org-${project.id}`,
    idempotencyKey: `fixture-org-${project.id}`,
    expectedRevision: 0,
    command: {
      type: 'organization.apply',
      operations: [
        {
          type: 'create_folder',
          folderId: 'reference-library',
          name: 'References',
          parentId: null,
        },
        {
          type: 'create_folder',
          folderId: 'old-takes',
          name: 'Earlier takes',
          parentId: null,
        },
        {
          type: 'assign_assets',
          folderId: 'reference-library',
          assetIds: images,
        },
        { type: 'assign_assets', folderId: 'old-takes', assetIds: [oldVideo] },
        {
          type: 'create_element',
          elementId: 'character',
          name: 'Synthetic character',
          kind: 'character',
          description: 'Synthetic reference for UI tests',
          versionId: 'v1',
          assetId: images[0],
        },
        {
          type: 'add_element_version',
          elementId: 'character',
          versionId: 'v2',
          assetId: images[1],
        },
      ],
    },
  });
  if (!organized.ok) throw new Error(organized.message);
  const final = (await loadProjectWithLatestSnapshot({
    projectId: project.id,
  }))!;
  const projection = projectCanvasOrganization(final.snapshot);
  if (final.snapshot.cards.length !== 140 || projection.nodes.length !== 12)
    throw new Error(
      `Fixture size mismatch: ${final.snapshot.cards.length} records, ${projection.nodes.length} entries`
    );
  const manifest = {
    syntheticOnly: true,
    projectId: project.id,
    targetProjectId: target.id,
    cards: 140,
    groups: 8,
    projectedEntries: 12,
    assetCount: assetIds.length,
    assetIds,
    imageAssetId: images[0],
    secondImageAssetId: images[1],
    oldVideoAssetId: oldVideo,
    newVideoAssetId: newVideo,
    timelineCardId,
    hashes,
    timelineUsage: getTimelineUsage(timeline.document, timeline.version),
  };
  await writeFile(
    resolve(directory, 'organization-fixture.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return manifest;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const isolatedDirectory = process.env.BEATDESIGN_DATA_DIR?.trim();
  try {
    const manifest = await seedOrganizationFixture();
    console.log(
      JSON.stringify({
        fixture: true,
        projectId: manifest.projectId,
        cards: manifest.cards,
        projectedEntries: manifest.projectedEntries,
      })
    );
  } finally {
    if (isolatedDirectory && resolve(isolatedDirectory) !== resolve('data'))
      (await getDb()).$client.close();
  }
}
