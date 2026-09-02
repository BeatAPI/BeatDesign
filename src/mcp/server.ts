import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

import { appConfig } from '@/config';
import {
  beatDesignCommandSchema,
  canvasCardSchema,
  canvasOperationSchema,
  editorOperationSchema,
} from '@/core/commands/schema';
import { importLocalProjectAsset } from '@/core/projects/import-local-asset';
import { createCommandId } from '@/core/commands/contracts';
import { persistBeatDesignCommand } from '@/core/commands/persist';
import { listCommandReceipts } from '@/core/commands/receipts';
import { diagnoseTimeline } from '@/core/editor/timeline-diagnostics';
import { loadProjectTimeline } from '@/core/editor/timeline-state';
import { syncGeneration } from '@/core/effects/generation-sync';
import { listProjectGenerations } from '@/core/effects/project-generations';
import { getGenerationById } from '@/core/effects/record-generation';
import {
  getGenerationModelDescriptor,
  listGenerationModelDescriptors,
  submitAssetFirstGeneration,
} from '@/core/generation-providers';
import {
  createProject,
  getProject,
  loadProjects,
  loadProjectWithLatestSnapshot,
} from '@/core/projects/projects';
import {
  getProjectAssetById,
  listProjectAssets,
} from '@/core/workspace-lib/assets/user-assets';

const VERSION = '0.2.1';
const idSchema = z.string().trim().min(1).max(200);

const toCommandCanvasCards = (cards: unknown[]) =>
  cards.flatMap((card) => {
    const parsed = canvasCardSchema.safeParse(card);
    return parsed.success ? [parsed.data] : [];
  });
const commandMetadataSchema = z.object({
  expectedRevision: z.number().int().min(0).nullable().optional(),
  commandId: idSchema.optional(),
  idempotencyKey: idSchema.optional(),
});

const generationReferenceSchema = z.object({
  assetId: idSchema,
  role: z.enum([
    'source',
    'reference',
    'style',
    'subject',
    'pose',
    'first_frame',
    'last_frame',
    'audio_track',
  ]),
  deliveryUrl: z.string().trim().min(1).max(4096).optional(),
});

const jsonResult = (result: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  structuredContent: { result },
});

class BeatDesignMcpToolError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(status: number, details: Record<string, unknown>) {
    super(
      typeof details.error === 'string'
        ? details.error
        : `BeatAPI request failed with status ${status}.`
    );
    this.name = 'BeatDesignMcpToolError';
    this.status = status;
    this.details = details;
  }
}

const errorResult = (error: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: error instanceof Error ? error.message : 'BeatDesign tool failed.',
    },
  ],
  isError: true,
  structuredContent: {
    error:
      error instanceof BeatDesignMcpToolError
        ? {
            message: error.message,
            status: error.status,
            details: error.details,
          }
        : {
            message:
              error instanceof Error ? error.message : 'BeatDesign tool failed.',
          },
  },
});

const withToolErrors = <TArgs, TResult>(
  handler: (args: TArgs) => Promise<TResult> | TResult
) => async (args: TArgs) => {
  try {
    return jsonResult(await handler(args));
  } catch (error) {
    return errorResult(error);
  }
};

async function executeExternalCommand({
  projectId,
  command,
  expectedRevision,
  commandId = createCommandId(),
  idempotencyKey = commandId,
}: {
  projectId: string;
  command: unknown;
  expectedRevision?: number | null;
  commandId?: string;
  idempotencyKey?: string;
}) {
  const parsed = beatDesignCommandSchema.parse(command);
  return persistBeatDesignCommand({
    projectId,
    origin: 'mcp',
    commandId,
    idempotencyKey,
    expectedRevision,
    command: parsed,
  });
}

function semanticTimelineSnapshot(
  timeline: Awaited<ReturnType<typeof loadProjectTimeline>>,
  time: number
) {
  if (!timeline) return null;
  const clampedTime = Math.max(0, Math.min(timeline.document.duration, time));
  const activeClips = timeline.document.tracks.flatMap((track) =>
    track.clips.flatMap((clip) => {
      if (
        clampedTime < clip.startTime ||
        clampedTime >= clip.startTime + clip.duration
      ) {
        return [];
      }
      const take = clip.activeTakeId
        ? clip.takes.find((candidate) => candidate.id === clip.activeTakeId)
        : null;
      return [
        {
          trackId: track.id,
          trackKind: track.kind,
          clipId: clip.id,
          assetId: take?.assetId ?? clip.assetId,
          sourceUrl: take?.sourceUrl ?? clip.sourceUrl,
          sourceTime: clip.inPoint + (clampedTime - clip.startTime),
          muted: track.muted || clip.muted,
          volume: clip.volume,
        },
      ];
    })
  );
  return {
    projectId: timeline.document.projectId,
    timelineId: timeline.document.id,
    revision: timeline.version,
    time: clampedTime,
    activeClips,
    note: 'Semantic snapshot only; pixel rendering is not available in the local MCP server yet.',
  };
}

export function createBeatDesignMcpServer() {
  const server = new McpServer({ name: 'beatdesign', version: VERSION });

  server.registerTool(
    'bdesign_project_list',
    {
      description: 'List local BeatDesign projects.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(24) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ limit }) => loadProjects({ limit }))
  );

  server.registerTool(
    'bdesign_project_get',
    {
      description: 'Read one project with its Canvas and Editor documents.',
      inputSchema: z.object({ projectId: idSchema, includeAssets: z.boolean().default(false) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, includeAssets }) => {
      const [canvas, timeline, assets] = await Promise.all([
        loadProjectWithLatestSnapshot({ projectId }),
        loadProjectTimeline(projectId),
        includeAssets ? listProjectAssets({ projectId }) : Promise.resolve(undefined),
      ]);
      if (!canvas) throw new Error('Project not found.');
      return {
        project: canvas.project,
        canvas: {
          ...canvas,
          snapshot: {
            ...canvas.snapshot,
            cards: toCommandCanvasCards(canvas.snapshot.cards),
          },
        },
        timeline,
        assets,
      };
    })
  );

  server.registerTool(
    'bdesign_project_create',
    {
      description: 'Create a new local BeatDesign project.',
      inputSchema: z.object({ name: z.string().trim().min(1).max(240) }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    withToolErrors(async ({ name }) => createProject({ name }))
  );

  server.registerTool(
    'bdesign_asset_list',
    {
      description: 'List Assets that belong to a project.',
      inputSchema: z.object({ projectId: idSchema, limit: z.number().int().min(1).max(500).default(100) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, limit }) => listProjectAssets({ projectId, limit }))
  );

  server.registerTool(
    'bdesign_asset_get',
    {
      description: 'Read one project Asset by stable assetId.',
      inputSchema: z.object({ projectId: idSchema, assetId: idSchema }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, assetId }) => {
      const asset = await getProjectAssetById({ projectId, assetId });
      if (!asset) throw new Error('Asset not found in this project.');
      return asset;
    })
  );

  server.registerTool(
    'bdesign_asset_import',
    {
      description:
        'Import a local image, video, or audio file into the project Asset library from an absolute path.',
      inputSchema: z.object({
        projectId: idSchema,
        filePath: z.string().trim().min(1).max(4096),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    withToolErrors(async ({ projectId, filePath }) =>
      importLocalProjectAsset({ projectId, filePath })
    )
  );

  server.registerTool(
    'bdesign_canvas_get',
    {
      description: 'Read the Canvas document and revision for a project.',
      inputSchema: z.object({ projectId: idSchema }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId }) => {
      const state = await loadProjectWithLatestSnapshot({ projectId });
      if (!state) throw new Error('Project not found.');
      return {
        revision: state.snapshotVersion,
        document: {
          ...state.snapshot,
          cards: toCommandCanvasCards(state.snapshot.cards),
        },
      };
    })
  );

  server.registerTool(
    'bdesign_canvas_search',
    {
      description: 'Search Canvas nodes by name, prompt, result text, model, kind, or media type.',
      inputSchema: z.object({
        projectId: idSchema,
        query: z.string().trim().max(500).default(''),
        kind: z.enum(['asset', 'generation', 'output']).optional(),
        type: z.enum(['image', 'video', 'audio', 'timeline']).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, query, kind, type }) => {
      const state = await loadProjectWithLatestSnapshot({ projectId });
      if (!state) throw new Error('Project not found.');
      const needle = query.toLocaleLowerCase();
      return toCommandCanvasCards(state.snapshot.cards).filter((card) => {
        if (kind && card.kind !== kind) return false;
        if (type && card.type !== type) return false;
        if (!needle) return true;
        return [card.id, card.name, card.prompt, card.resultText, card.modelId]
          .filter((value): value is string => typeof value === 'string')
          .some((value) => value.toLocaleLowerCase().includes(needle));
      });
    })
  );

  server.registerTool(
    'bdesign_canvas_apply',
    {
      description: 'Apply incremental Canvas operations. Raw document replacement is not exposed.',
      inputSchema: commandMetadataSchema.extend({
        projectId: idSchema,
        operations: z.array(canvasOperationSchema).min(1).max(500),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({ projectId, operations, ...metadata }) =>
      executeExternalCommand({
        projectId,
        ...metadata,
        command: { type: 'canvas.apply', operations },
      })
    )
  );

  server.registerTool(
    'bdesign_generation_models',
    {
      description: 'List logical generation models and their current parameter/reference capabilities.',
      inputSchema: z.object({ kind: z.enum(['image', 'video', 'analysis']).optional() }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(({ kind }) =>
      listGenerationModelDescriptors().filter((model) => !kind || model.kind === kind)
    )
  );

  server.registerTool(
    'bdesign_generation_model_get',
    {
      description: 'Read one logical model, including defaults and accepted parameters.',
      inputSchema: z.object({ modelId: idSchema }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(({ modelId }) => {
      const model = getGenerationModelDescriptor(modelId);
      if (!model) throw new Error('Generation model not found.');
      return model;
    })
  );

  server.registerTool(
    'bdesign_generation_submit',
    {
      description: 'Submit an asset-first image, video, or analysis generation. Outputs are recorded as reusable Assets.',
      inputSchema: z.object({
        projectId: idSchema,
        mode: z.enum(['image', 'video', 'analysis']),
        modelId: idSchema,
        prompt: z.string().max(20_000),
        references: z.array(generationReferenceSchema).max(20).default([]),
        parameters: z.record(z.string(), z.unknown()).default({}),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    withToolErrors(async (input) => {
      const result = await submitAssetFirstGeneration({
        origin: 'mcp',
        generation: { version: 1, ...input },
      });
      if (result.status >= 400) {
        throw new BeatDesignMcpToolError(result.status, result.body);
      }
      return result.body;
    })
  );

  server.registerTool(
    'bdesign_generation_status',
    {
      description: 'Read and, when possible, refresh one generation task.',
      inputSchema: z.object({ generationId: idSchema, refresh: z.boolean().default(true) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ generationId, refresh }) => {
      const generation = await getGenerationById({ id: generationId });
      if (!generation) throw new Error('Generation not found.');
      if (
        refresh &&
        (generation.status === 'pending' || generation.status === 'processing')
      ) {
        return syncGeneration({ wmTaskId: generationId, effectId: generation.effectId });
      }
      return generation;
    })
  );

  server.registerTool(
    'bdesign_generation_history',
    {
      description: 'List generation history for a project.',
      inputSchema: z.object({ projectId: idSchema, limit: z.number().int().min(1).max(200).default(80) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, limit }) => listProjectGenerations(projectId, limit))
  );

  server.registerTool(
    'bdesign_editor_get',
    {
      description: 'Read the current Editor timeline and revision.',
      inputSchema: z.object({ projectId: idSchema }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId }) => {
      const project = await getProject({ projectId });
      if (!project) throw new Error('Project not found.');
      return loadProjectTimeline(projectId);
    })
  );

  server.registerTool(
    'bdesign_editor_edit',
    {
      description: 'Apply incremental timeline operations such as add, trim, split, move, remove, audio updates, and Takes.',
      inputSchema: commandMetadataSchema.extend({
        projectId: idSchema,
        operations: z.array(editorOperationSchema).min(1).max(500),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({ projectId, operations, ...metadata }) =>
      executeExternalCommand({
        projectId,
        ...metadata,
        command: { type: 'editor.apply', operations },
      })
    )
  );

  server.registerTool(
    'bdesign_editor_snapshot',
    {
      description: 'Resolve the active timeline clips at a time. This is semantic inspection, not a pixel screenshot.',
      inputSchema: z.object({ projectId: idSchema, time: z.number().finite().min(0) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, time }) =>
      semanticTimelineSnapshot(await loadProjectTimeline(projectId), time)
    )
  );

  server.registerTool(
    'bdesign_editor_diagnostics',
    {
      description: 'Diagnose gaps, overlaps, missing media, duration mismatches, and tiny clips.',
      inputSchema: z.object({ projectId: idSchema }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId }) => {
      const timeline = await loadProjectTimeline(projectId);
      if (!timeline) return { diagnostics: [], revision: null };
      return {
        diagnostics: diagnoseTimeline(timeline.document),
        revision: timeline.version,
      };
    })
  );

  server.registerTool(
    'bdesign_editor_view',
    {
      description: 'Build an Editor deep link for a time and return its semantic snapshot.',
      inputSchema: z.object({ projectId: idSchema, time: z.number().finite().min(0).default(0) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, time }) => ({
      editorUrl: `${appConfig.app_url.replace(/\/$/, '')}/editor/${encodeURIComponent(projectId)}?t=${time}`,
      snapshot: semanticTimelineSnapshot(await loadProjectTimeline(projectId), time),
    }))
  );

  server.registerTool(
    'bdesign_editor_history',
    {
      description: 'Read persisted command receipts for timeline and Canvas changes.',
      inputSchema: z.object({ projectId: idSchema, limit: z.number().int().min(1).max(200).default(50) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, limit }) => listCommandReceipts({ projectId, limit }))
  );

  return server;
}

export function startBeatDesignMcpServer() {
  return serveStdio(createBeatDesignMcpServer, {
    onerror: (error) => console.error('[BeatDesign MCP]', error),
  });
}

export function createBeatDesignMcpHttpHandler() {
  return createMcpHandler(createBeatDesignMcpServer, {
    legacy: 'stateless',
    responseMode: 'auto',
    onerror: (error) => console.error('[BeatDesign MCP HTTP]', error),
  });
}
