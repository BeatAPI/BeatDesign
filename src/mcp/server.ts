import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve as resolvePath } from 'node:path';

import {
  createMcpHandler,
  McpServer,
  ResourceNotFoundError,
  ResourceTemplate,
} from '@modelcontextprotocol/server';
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
import { parseLocalProjectAssetUrl } from '@/core/projects/local-project-asset-url';
import { createCommandId } from '@/core/commands/contracts';
import { listCommandReceipts } from '@/core/commands/receipts';
import {
  findCaptionAtTime,
  MAX_SRT_FILE_BYTES,
} from '@/core/editor/captions';
import { diagnoseTimeline } from '@/core/editor/timeline-diagnostics';
import {
  removeRenderedProjectTimelineAsset,
  renderProjectTimelineToAsset,
} from '@/core/editor/render-project-timeline';
import { loadProjectTimeline } from '@/core/editor/timeline-state';
import { syncGeneration } from '@/core/effects/generation-sync';
import { resolveOutputMedia } from '@/core/effects/output-media';
import { listProjectGenerations } from '@/core/effects/project-generations';
import { getGenerationById } from '@/core/effects/record-generation';
import { resolveVideoAnalysisText } from '@/core/effects/video-analysis';
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
  BEATDESIGN_SKILL_CATALOG_URI,
  BEATDESIGN_SKILL_RESOURCE_TEMPLATE,
  beatDesignSkillIdSchema,
  loadBeatDesignSkillRegistry,
  type BeatDesignSkill,
} from '@/core/skills/skill-registry';
import {
  getProjectAssetById,
  listProjectAssets,
} from '@/core/workspace-lib/assets/user-assets';
import {
  buildBeatDesignWorkspaceHandoff,
  formatBeatDesignWorkspaceHandoff,
  type BeatDesignWorkspaceHandoff,
} from './workspace-handoff';
import {
  buildCanvasGenerationStatusOperations,
  prepareCanvasGenerationSubmission,
  runCanvasGenerationSubmissionOnce,
} from './generation-canvas';
import { BEATDESIGN_MCP_TOOL_NAMES } from './tools';

import { version as VERSION } from '../../package.json';
const idSchema = z.string().trim().min(1).max(200);
const builtInSkillDirectory = resolvePath(process.cwd(), 'skills', 'official');
let builtInSkillRegistryPromise: ReturnType<
  typeof loadBeatDesignSkillRegistry
> | null = null;

const getBuiltInSkillRegistry = () => {
  builtInSkillRegistryPromise ??= loadBeatDesignSkillRegistry({
    directory: builtInSkillDirectory,
    beatDesignVersion: VERSION,
    availableMcpTools: BEATDESIGN_MCP_TOOL_NAMES,
  });
  return builtInSkillRegistryPromise;
};

const formatSkillResource = (skill: BeatDesignSkill) =>
  [
    `# ${skill.manifest.title}`,
    '',
    `Skill ID: ${skill.manifest.id}`,
    `Skill version: ${skill.manifest.version}`,
    `BeatDesign compatibility: ${skill.compatible ? 'compatible' : 'incompatible'}`,
    ...(skill.incompatibilities.length > 0
      ? [`Compatibility issues: ${skill.incompatibilities.join(' ')}`]
      : []),
    '',
    skill.instructions,
  ].join('\n');

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
  maxAttempts,
}: {
  projectId: string;
  command: unknown;
  expectedRevision?: number | null;
  commandId?: string;
  idempotencyKey?: string;
  maxAttempts?: number;
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
    maxAttempts,
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
          caption: clip.caption,
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

  server.registerResource(
    'beatdesign-skill-catalog',
    BEATDESIGN_SKILL_CATALOG_URI,
    {
      title: 'BeatDesign Skill catalog',
      description:
        'Versioned catalog of official creative Skills bundled with this BeatDesign installation.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            (await getBuiltInSkillRegistry()).catalog(),
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    'beatdesign-skill',
    new ResourceTemplate(BEATDESIGN_SKILL_RESOURCE_TEMPLATE, {
      list: async () => ({
        resources: (await getBuiltInSkillRegistry()).list().map((skill) => ({
          uri: skill.resourceUri,
          name: skill.manifest.id,
          title: skill.manifest.title,
          description: skill.manifest.summary,
          mimeType: 'text/markdown',
        })),
      }),
      complete: {
        skillId: async (value) =>
          (await getBuiltInSkillRegistry())
            .list()
            .map((skill) => skill.manifest.id)
            .filter((skillId) => skillId.startsWith(value)),
      },
    }),
    {
      title: 'BeatDesign Skill',
      description:
        'Full model-readable instructions for one bundled BeatDesign creative Skill.',
      mimeType: 'text/markdown',
    },
    async (uri, variables) => {
      const rawSkillId = Array.isArray(variables.skillId)
        ? variables.skillId[0]
        : variables.skillId;
      const skillId = beatDesignSkillIdSchema.parse(rawSkillId);
      const skill = (await getBuiltInSkillRegistry()).get(skillId);
      if (!skill) {
        throw new ResourceNotFoundError(
          uri.href,
          `BeatDesign Skill not found: ${skillId}`
        );
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: formatSkillResource(skill),
          },
        ],
      };
    }
  );

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

  const persistGenerationCanvasStatus = async ({
    projectId,
    generationId,
    status,
    output,
    error,
    commandKey,
    sourceCardId,
    outputCardId,
  }: {
    projectId: string;
    generationId: string | null;
    status: 'pending' | 'processing' | 'succeeded' | 'failed';
    output?: unknown;
    error?: string | null;
    commandKey: string;
    sourceCardId?: string;
    outputCardId?: string;
  }) => {
    const latest = await loadProjectWithLatestSnapshot({ projectId });
    if (!latest) return null;
    const cards = toCommandCanvasCards(latest.snapshot.cards);
    const outputCard = cards.find(
      (card) =>
        card.kind === 'output' &&
        (outputCardId
          ? card.id === outputCardId
          : generationId
            ? card.sourceGenerationId === generationId
            : false)
    );
    const sourceCard = cards.find(
      (card) =>
        card.kind === 'generation' &&
        card.id === (sourceCardId ?? outputCard?.sourceConfigCardId)
    );
    if (
      !sourceCard ||
      sourceCard.kind !== 'generation' ||
      !outputCard ||
      outputCard.kind !== 'output'
    ) return null;
    const media = resolveOutputMedia(output);
    const applied = await executeExternalCommand({
      projectId,
      commandId: commandKey,
      idempotencyKey: commandKey,
      expectedRevision: latest.snapshotVersion,
      command: {
        type: 'canvas.apply',
        operations: buildCanvasGenerationStatusOperations({
          sourceCard,
          outputCard,
          generationId,
          status,
          resultUrl: media.resultUrl,
          resultText: resolveVideoAnalysisText(output),
          resultAssetId:
            parseLocalProjectAssetUrl(media.resultUrl)?.assetId ?? null,
          error,
        }),
      },
    });
    if (!applied.ok) throw new Error(applied.message);
    return applied;
  };

  server.registerTool(
    'bdesign_skill_list',
    {
      description:
        'List official creative Skills bundled with this BeatDesign installation, including compatibility and MCP resource URIs.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async () => (await getBuiltInSkillRegistry()).catalog())
  );

  server.registerTool(
    'bdesign_skill_get',
    {
      description:
        'Read one bundled BeatDesign Skill with its manifest, compatibility result, and full workflow instructions.',
      inputSchema: z.object({ skillId: beatDesignSkillIdSchema }),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ skillId }) => {
      const skill = (await getBuiltInSkillRegistry()).get(skillId);
      if (!skill) throw new Error(`BeatDesign Skill not found: ${skillId}`);
      return skill;
    })
  );

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
        'Extract the tail frame of a video, place it on Canvas, and create a continuation generation node. The returned prompt explicitly maps @Image1 as the first frame; submit the image as a normal reference.',
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
      description: 'Submit from a reviewed Canvas generation node. A visible output node is created before the provider request, and successful outputs remain reusable Assets.',
      inputSchema: commandMetadataSchema.extend({
        projectId: idSchema.optional(),
        sourceCardId: idSchema,
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
      const commandId = input.commandId ?? input.idempotencyKey ?? createCommandId();
      const stableRequestKey = input.idempotencyKey ?? commandId;
      return runCanvasGenerationSubmissionOnce({
        key: `${project.id}:${stableRequestKey}`,
        submit: async () => {
          const state = await loadProjectWithLatestSnapshot({
            projectId: project.id,
          });
          if (!state) throw new Error('Project not found.');
          const descriptor = getGenerationModelDescriptor(input.modelId);
          if (!descriptor) throw new Error('Generation model not found.');
          const outputCardId = `output:${commandId}`;
          const plan = prepareCanvasGenerationSubmission({
            cards: toCommandCanvasCards(state.snapshot.cards),
            sourceCardId: input.sourceCardId,
            submitted: {
              mode: input.mode,
              modelId: input.modelId,
              prompt: input.prompt,
              references: input.references,
              parameters: input.parameters,
            },
            descriptor,
            outputCardId,
            generationRunId: `run:${commandId}`,
            capturedAt: new Date().toISOString(),
          });
          const placed = await executeExternalCommand({
            projectId: project.id,
            commandId: `${commandId}:place`,
            idempotencyKey: `${stableRequestKey}:place`,
            expectedRevision: input.expectedRevision ?? state.snapshotVersion,
            command: { type: 'canvas.apply', operations: plan.operations },
          });
          if (!placed.ok) throw new Error(placed.message);

          let result: Awaited<ReturnType<typeof submitAssetFirstGeneration>>;
          try {
            result = await submitAssetFirstGeneration({
              origin: 'mcp',
              generation: { ...plan.request, projectId: project.id },
            });
          } catch (error) {
            await persistGenerationCanvasStatus({
              projectId: project.id,
              generationId: null,
              status: 'failed',
              error:
                error instanceof Error
                  ? error.message
                  : 'Generation submission failed.',
              commandKey: `${stableRequestKey}:status:failed`,
              sourceCardId: input.sourceCardId,
              outputCardId,
            }).catch(() => undefined);
            throw error;
          }
          const generationId =
            typeof result.body.wmTaskId === 'string'
              ? result.body.wmTaskId
              : null;
          const status =
            result.status >= 400
              ? 'failed'
              : result.body.status === 'succeeded'
                ? 'succeeded'
                : result.body.status === 'failed'
                  ? 'failed'
                  : result.body.status === 'pending'
                    ? 'pending'
                    : 'processing';
          await persistGenerationCanvasStatus({
            projectId: project.id,
            generationId,
            status,
            output: result.body.output,
            error:
              typeof result.body.error === 'string' ? result.body.error : null,
            commandKey: `${stableRequestKey}:status:${status}`,
            sourceCardId: input.sourceCardId,
            outputCardId,
          });
          if (result.status >= 400) {
            throw new BeatDesignMcpToolError(result.status, result.body);
          }
          return {
            ...result.body,
            sourceCardId: input.sourceCardId,
            outputCardId,
            canvasRevision: placed.revision,
          };
        },
      });
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
        const synced = await syncGeneration({
          wmTaskId: generationId,
          effectId: generation.effectId,
        });
        if (synced.ok && generation.projectId) {
          await persistGenerationCanvasStatus({
            projectId: generation.projectId,
            generationId,
            status: synced.generation.status,
            output: synced.generation.output,
            error: synced.generation.error,
            commandKey: `generation-status:${generationId}:${synced.generation.status}`,
          });
        }
        return synced;
      }
      if (generation.projectId) {
        await persistGenerationCanvasStatus({
          projectId: generation.projectId,
          generationId,
          status: generation.status,
          output: generation.output,
          error: generation.error,
          commandKey: `generation-status:${generationId}:${generation.status}`,
        });
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
      description: 'Apply incremental timeline operations such as media and image-overlay add/update, trim, split, move, remove, audio updates, Takes, captions, per-caption layout, caption styles, and SRT import.',
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
    'bdesign_editor_render',
    {
      description:
        'Render the authoritative Editor timeline to a project-owned MP4 Asset with overlays, captions, and mixed audio. Requires local ffmpeg and ffprobe.',
      inputSchema: z.object({
        projectId: idSchema.optional(),
        expectedRevision: z.number().int().min(0).nullable().optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    withToolErrors(async ({ projectId, expectedRevision }) => {
      const project = await resolveScopedProject(projectId);
      const timeline = await loadProjectTimeline(project.id);
      if (!timeline) throw new Error('Timeline not found.');
      if (
        typeof expectedRevision === 'number' &&
        expectedRevision !== timeline.version
      ) {
        throw new Error(
          `Timeline revision conflict. Read the latest timeline and retry with expectedRevision ${timeline.version}.`
        );
      }
      const asset = await renderProjectTimelineToAsset({
        projectId: project.id,
        document: timeline.document,
        timelineRevision: timeline.version,
      });
      const result = await executeExternalCommand({
        projectId: project.id,
        expectedRevision: timeline.version,
        maxAttempts: 1,
        command: {
          type: 'editor.apply',
          operations: [
            {
              type: 'set_render',
              assetId: asset.id,
              publicUrl: asset.publicUrl,
            },
          ],
        },
      });
      if (!result.ok) {
        await removeRenderedProjectTimelineAsset({
          projectId: project.id,
          assetId: asset.id,
        });
        throw new Error(result.message);
      }
      return {
        asset,
        timelineRevision: result.revision,
        commandId: result.commandId,
      };
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
