import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve as resolvePath } from 'node:path';

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

import {
  beatDesignCommandSchema,
  canvasCardSchema,
  canvasOperationSchema,
  editorOperationSchema,
} from '@/core/commands/schema';
import { persistExternalCommandWithConflictRetry } from '@/core/commands/conflict-retry';
import { continueFromTailFrame } from '@/core/projects/continue-from-tail-frame';
import { extractProjectVideoFrame } from '@/core/projects/extract-project-video-frame';
import { importLocalProjectAsset } from '@/core/projects/import-local-asset';
import { createCommandId } from '@/core/commands/contracts';
import { listCommandReceipts } from '@/core/commands/receipts';
import {
  findCaptionAtTime,
  MAX_SRT_FILE_BYTES,
} from '@/core/editor/captions';
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
  getActiveProject,
  loadProjects,
  loadProjectWithLatestSnapshot,
} from '@/core/projects/projects';
import {
  getProjectAssetById,
  listProjectAssets,
} from '@/core/workspace-lib/assets/user-assets';
import {
  buildBeatDesignWorkspaceHandoff,
  formatBeatDesignWorkspaceHandoff,
  type BeatDesignWorkspaceHandoff,
} from './workspace-handoff';

const VERSION = '0.2.2';
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

const workspaceHandoffResult = (
  handoff: BeatDesignWorkspaceHandoff,
  extra: Record<string, unknown> = {}
) => {
  const result = { ...handoff, ...extra };
  return {
    content: [
      {
        type: 'text' as const,
        text: formatBeatDesignWorkspaceHandoff(handoff),
      },
    ],
    structuredContent: {
      ...result,
      result,
    },
  };
};

const withWorkspaceHandoffErrors = <TArgs>(
  handler: (
    args: TArgs
  ) =>
    | Promise<{
        handoff: BeatDesignWorkspaceHandoff;
        extra?: Record<string, unknown>;
      }>
    | {
        handoff: BeatDesignWorkspaceHandoff;
        extra?: Record<string, unknown>;
      }
) => async (args: TArgs) => {
  try {
    const { handoff, extra } = await handler(args);
    return workspaceHandoffResult(handoff, extra);
  } catch (error) {
    return errorResult(error);
  }
};

const assertActiveProject = async (projectId: string) => {
  const project = await getActiveProject({ projectId });
  if (!project) throw new Error('Project not found.');
  return project;
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
  if (!(await getActiveProject({ projectId }))) {
    throw new Error('Project not found.');
  }
  const parsed = beatDesignCommandSchema.parse(command);
  return persistExternalCommandWithConflictRetry({
    input: {
      projectId,
      origin: 'mcp',
      commandId,
      idempotencyKey,
      expectedRevision,
      command: parsed,
    },
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
          overlay: clip.overlay,
          fadeIn: clip.fadeIn,
          fadeOut: clip.fadeOut,
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
    caption: (() => {
      const cue = findCaptionAtTime(timeline.document, clampedTime);
      return cue
        ? {
            clipId: cue.id,
            text: cue.text ?? cue.name,
            startTime: cue.startTime,
            duration: cue.duration,
          }
        : null;
    })(),
    note: 'Semantic snapshot only; pixel rendering is not available in the local MCP server yet.',
  };
}

export function createBeatDesignMcpServer() {
  const server = new McpServer({ name: 'beatdesign', version: VERSION });
  let targetedProjectId: string | null = null;

  const resolveScopedProject = async (projectId?: string | null) => {
    const resolvedProjectId = projectId?.trim() || targetedProjectId;
    if (!resolvedProjectId) {
      throw new Error(
        'No BeatDesign project is selected. Call bdesign_project_list, then bdesign_project_target, or pass projectId explicitly.'
      );
    }
    const project = await getActiveProject({ projectId: resolvedProjectId });
    if (!project) throw new Error('Project not found.');
    return project;
  };

  const buildProjectHandoff = (
    project: Awaited<ReturnType<typeof getActiveProject>> & {},
    options: {
      view?: string | null;
      focusCardId?: string | null;
      time?: number | null;
    } = {}
  ) =>
    buildBeatDesignWorkspaceHandoff({
      projectId: project.id,
      name: project.name,
      view: options.view ?? project.lastWorkspaceMode,
      focusCardId: options.focusCardId,
      time: options.time,
    });

  server.registerTool(
    'bdesign_project_list',
    {
      description: 'List local BeatDesign projects.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(24) }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ limit }) =>
      (await loadProjects({ limit })).map((project: { id: string }) => ({
        ...project,
        targeted: project.id === targetedProjectId,
      }))
    )
  );

  server.registerTool(
    'bdesign_project_get',
    {
      description: 'Read one project with its Canvas and Editor documents.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        includeAssets: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, includeAssets }) => {
      const project = await resolveScopedProject(projectId);
      const scopedProjectId = project.id;
      const [canvas, timeline, assets] = await Promise.all([
        loadProjectWithLatestSnapshot({ projectId: scopedProjectId }),
        loadProjectTimeline(scopedProjectId),
        includeAssets
          ? listProjectAssets({ projectId: scopedProjectId })
          : Promise.resolve(undefined),
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
    withWorkspaceHandoffErrors(async ({ name }) => {
      const created = await createProject({ name });
      targetedProjectId = created.id;
      const project = await resolveScopedProject(created.id);
      return {
        handoff: buildProjectHandoff(project, { view: 'canvas' }),
        extra: { project: created, targeted: true },
      };
    })
  );

  server.registerTool(
    'bdesign_project_target',
    {
      description:
        'Bind this MCP session to a BeatDesign project so later project-scoped tools may omit projectId, and return the requested workspace handoff.',
      inputSchema: z.object({
        projectId: idSchema,
        view: z.enum(['studio', 'canvas', 'editor', 'assets']).optional(),
        focusCardId: idSchema.optional(),
        time: z.number().finite().min(0).optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withWorkspaceHandoffErrors(async ({ projectId, view, focusCardId, time }) => {
      const project = await resolveScopedProject(projectId);
      targetedProjectId = project.id;
      const [canvas, timeline] = await Promise.all([
        loadProjectWithLatestSnapshot({ projectId: project.id }),
        loadProjectTimeline(project.id),
      ]);
      return {
        handoff: buildProjectHandoff(project, { view, focusCardId, time }),
        extra: {
          targeted: true,
          orientation: {
            canvasRevision: canvas?.snapshotVersion ?? null,
            timelineId: timeline?.document.id ?? null,
            timelineRevision: timeline?.version ?? null,
          },
        },
      };
    })
  );

  server.registerTool(
    'bdesign_project_open',
    {
      description:
        'Return a browser handoff for the selected BeatDesign project. Use it early so the user can watch Agent changes in Canvas, Editor, Studio, or Assets.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        view: z.enum(['studio', 'canvas', 'editor', 'assets']).optional(),
        focusCardId: idSchema.optional(),
        time: z.number().finite().min(0).optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withWorkspaceHandoffErrors(async ({
      projectId,
      view,
      focusCardId,
      time,
    }) => {
      const project = await resolveScopedProject(projectId);
      return {
        handoff: buildProjectHandoff(project, {
          view,
          focusCardId,
          time,
        }),
      };
    })
  );

  server.registerTool(
    'bdesign_asset_list',
    {
      description: 'List Assets that belong to a project.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        limit: z.number().int().min(1).max(500).default(100),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, limit }) => {
      const project = await resolveScopedProject(projectId);
      return listProjectAssets({ projectId: project.id, limit });
    })
  );

  server.registerTool(
    'bdesign_asset_get',
    {
      description: 'Read one project Asset by stable assetId.',
      inputSchema: z.object({ projectId: idSchema.optional(), assetId: idSchema }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, assetId }) => {
      const project = await resolveScopedProject(projectId);
      const asset = await getProjectAssetById({
        projectId: project.id,
        assetId,
      });
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
        projectId: idSchema.optional(),
        filePath: z.string().trim().min(1).max(4096),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    withToolErrors(async ({ projectId, filePath }) => {
      const project = await resolveScopedProject(projectId);
      return importLocalProjectAsset({ projectId: project.id, filePath });
    })
  );

  server.registerTool(
    'bdesign_asset_extract_frame',
    {
      description:
        'Extract a PNG frame from a project video Asset. Use position last for tail-frame continuation.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        assetId: idSchema,
        position: z.union([z.enum(['first', 'last']), z.number()]).default('last'),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    withToolErrors(async ({ projectId, assetId, position }) => {
      const project = await resolveScopedProject(projectId);
      return extractProjectVideoFrame({
        projectId: project.id,
        assetId,
        position,
      });
    })
  );

  server.registerTool(
    'bdesign_canvas_get',
    {
      description: 'Read the Canvas document and revision for a project.',
      inputSchema: z.object({ projectId: idSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId }) => {
      const project = await resolveScopedProject(projectId);
      const state = await loadProjectWithLatestSnapshot({
        projectId: project.id,
      });
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
    'bdesign_canvas_view',
    {
      description:
        'Return a Canvas browser handoff, optionally focused on one card, plus the current Canvas revision and focused card summary.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        cardId: idSchema.optional(),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    withWorkspaceHandoffErrors(async ({ projectId, cardId }) => {
      const project = await resolveScopedProject(projectId);
      const state = await loadProjectWithLatestSnapshot({
        projectId: project.id,
      });
      if (!state) throw new Error('Project not found.');
      const cards = toCommandCanvasCards(state.snapshot.cards);
      const focusedCard = cardId
        ? (cards.find((card) => card.id === cardId) ?? null)
        : null;
      if (cardId && !focusedCard) {
        throw new Error('Canvas card not found in this project.');
      }
      return {
        handoff: buildProjectHandoff(project, {
          view: 'canvas',
          focusCardId: cardId,
        }),
        extra: {
          canvas: {
            revision: state.snapshotVersion,
            cardCount: cards.length,
            focusedCard,
          },
        },
      };
    })
  );

  server.registerTool(
    'bdesign_canvas_search',
    {
      description: 'Search Canvas nodes by name, prompt, result text, model, kind, or media type.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        query: z.string().trim().max(500).default(''),
        kind: z.enum(['asset', 'generation', 'output']).optional(),
        type: z.enum(['image', 'video', 'audio', 'timeline']).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, query, kind, type }) => {
      const project = await resolveScopedProject(projectId);
      const state = await loadProjectWithLatestSnapshot({
        projectId: project.id,
      });
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
      description:
        'Apply incremental Canvas operations. For a newly connected node, append place_card to position it once to the right of its references; later user drag positions remain untouched unless place_card is called again. Raw document replacement is not exposed.',
      inputSchema: commandMetadataSchema.extend({
        projectId: idSchema.optional(),
        operations: z.array(canvasOperationSchema).min(1).max(500),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({ projectId, operations, ...metadata }) => {
      const project = await resolveScopedProject(projectId);
      return executeExternalCommand({
        projectId: project.id,
        ...metadata,
        command: { type: 'canvas.apply', operations },
      });
    })
  );

  server.registerTool(
    'bdesign_canvas_continue_from_tail',
    {
      description:
        'Extract the tail frame of a video, place it on Canvas, and create a continuation generation node. Then call bdesign_generation_submit with the returned first_frame reference.',
      inputSchema: commandMetadataSchema.extend({
        projectId: idSchema.optional(),
        sourceCardId: idSchema.optional(),
        assetId: idSchema.optional(),
        prompt: z.string().max(20_000).default(''),
        modelId: idSchema.optional(),
        position: z.union([z.enum(['first', 'last']), z.number()]).default('last'),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({
      projectId,
      sourceCardId,
      assetId,
      prompt,
      modelId,
      position,
      commandId,
      expectedRevision,
      idempotencyKey,
    }) => {
      const project = await resolveScopedProject(projectId);
      return continueFromTailFrame({
        projectId: project.id,
        sourceCardId,
        assetId,
        prompt,
        modelId,
        position,
        commandId: commandId ?? idempotencyKey,
        expectedRevision,
      });
    }
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
        projectId: idSchema.optional(),
        mode: z.enum(['image', 'video', 'analysis']),
        modelId: idSchema,
        prompt: z.string().max(20_000),
        references: z.array(generationReferenceSchema).max(20).default([]),
        parameters: z.record(z.string(), z.unknown()).default({}),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    withToolErrors(async (input) => {
      const project = await resolveScopedProject(input.projectId);
      const result = await submitAssetFirstGeneration({
        origin: 'mcp',
        generation: { version: 1, ...input, projectId: project.id },
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
      inputSchema: z.object({
        generationId: idSchema,
        projectId: idSchema.optional(),
        refresh: z.boolean().default(true),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ generationId, projectId, refresh }) => {
      const generation = await getGenerationById({ id: generationId });
      if (!generation) throw new Error('Generation not found.');
      const scopedProjectId = projectId ?? targetedProjectId;
      if (scopedProjectId) {
        const project = await resolveScopedProject(scopedProjectId);
        if (generation.projectId !== project.id) {
          throw new Error('Generation not found in this project.');
        }
      } else if (generation.projectId) {
        await assertActiveProject(generation.projectId);
      }
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
      inputSchema: z.object({
        projectId: idSchema.optional(),
        limit: z.number().int().min(1).max(200).default(80),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, limit }) => {
      const project = await resolveScopedProject(projectId);
      return listProjectGenerations(project.id, limit);
    })
  );

  server.registerTool(
    'bdesign_editor_get',
    {
      description: 'Read the current Editor timeline and revision.',
      inputSchema: z.object({ projectId: idSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId }) => {
      const project = await resolveScopedProject(projectId);
      return loadProjectTimeline(project.id);
    })
  );

  server.registerTool(
    'bdesign_editor_edit',
    {
      description: 'Apply incremental timeline operations such as media and image-overlay add/update, trim, split, move, remove, audio updates, Takes, captions, caption styles, and SRT import.',
      inputSchema: commandMetadataSchema.extend({
        projectId: idSchema.optional(),
        operations: z.array(editorOperationSchema).min(1).max(500),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({ projectId, operations, ...metadata }) => {
      const project = await resolveScopedProject(projectId);
      return executeExternalCommand({
        projectId: project.id,
        ...metadata,
        command: { type: 'editor.apply', operations },
      });
    })
  );

  server.registerTool(
    'bdesign_editor_import_srt',
    {
      description:
        'Import SRT captions onto the project timeline caption track. Provide srt text or an absolute filePath.',
      inputSchema: commandMetadataSchema.extend({
        projectId: idSchema.optional(),
        srt: z.string().min(1).max(200_000).optional(),
        filePath: z.string().trim().min(1).max(4096).optional(),
        replace: z.boolean().default(true),
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({
      projectId,
      srt,
      filePath,
      replace,
      commandId,
      expectedRevision,
      idempotencyKey,
    }) => {
      const project = await resolveScopedProject(projectId);
      let source = srt?.trim() ?? '';
      if (!source && filePath) {
        const trimmedPath = filePath.trim();
        if (!isAbsolute(trimmedPath)) {
          throw new Error('SRT import requires an absolute file path.');
        }
        const sourceStat = await stat(resolvePath(trimmedPath));
        if (!sourceStat.isFile() || sourceStat.size > MAX_SRT_FILE_BYTES) {
          throw new Error('SRT file is too large or is not a regular file.');
        }
        source = await readFile(resolvePath(trimmedPath), 'utf8');
      }
      if (!source.trim()) {
        throw new Error('Provide srt text or filePath.');
      }
      return executeExternalCommand({
        projectId: project.id,
        commandId,
        expectedRevision,
        idempotencyKey,
        command: { type: 'editor.apply', operations: [{ type: 'import_srt', srt: source, replace }] },
      });
    })
  );

  server.registerTool(
    'bdesign_editor_snapshot',
    {
      description: 'Resolve the active timeline clips at a time. This is semantic inspection, not a pixel screenshot.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        time: z.number().finite().min(0),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, time }) => {
      const project = await resolveScopedProject(projectId);
      return semanticTimelineSnapshot(
        await loadProjectTimeline(project.id),
        time
      );
    })
  );

  server.registerTool(
    'bdesign_editor_diagnostics',
    {
      description: 'Diagnose gaps, overlaps, missing media, duration mismatches, and tiny clips.',
      inputSchema: z.object({ projectId: idSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId }) => {
      const project = await resolveScopedProject(projectId);
      const timeline = await loadProjectTimeline(project.id);
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
      description:
        'Return an Editor browser handoff for a timeline time and include its semantic snapshot.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        time: z.number().finite().min(0).default(0),
      }),
      annotations: { readOnlyHint: true },
    },
    withWorkspaceHandoffErrors(async ({ projectId, time }) => {
      const project = await resolveScopedProject(projectId);
      return {
        handoff: buildProjectHandoff(project, { view: 'editor', time }),
        extra: {
          snapshot: semanticTimelineSnapshot(
            await loadProjectTimeline(project.id),
            time
          ),
        },
      };
    })
  );

  server.registerTool(
    'bdesign_editor_history',
    {
      description: 'Read persisted command receipts for timeline and Canvas changes.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, limit }) => {
      const project = await resolveScopedProject(projectId);
      return listCommandReceipts({ projectId: project.id, limit });
    })
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
