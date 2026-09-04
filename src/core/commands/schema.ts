import { z } from 'zod';

import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { normalizeTimelineDocument } from '@/core/editor/timeline-document';

import { repairCanvasCardInput } from './canvas-card-repair';
import type { BeatDesignCommand } from './executor';

const commandIdSchema = z.string().trim().min(1).max(200);
const finiteTimeSchema = z.number().finite().min(0).max(86_400);
const positiveDurationSchema = z.number().finite().positive().max(86_400);

const frameSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
  })
  .strict();

const canvasCardStatusSchema = z.enum([
  'idle',
  'pending',
  'processing',
  'succeeded',
  'failed',
]);
const generationModeSchema = z.enum(['image', 'video', 'analysis']);
const analysisDepthSchema = z.enum(['standard', 'deep']);
const aspectRatioSchema = z.enum([
  '16:9',
  '21:9',
  '4:3',
  '5:4',
  '9:16',
  '9:21',
  '3:4',
  '1:1',
  '1:2',
  '2:1',
  '1:3',
  '3:1',
  '2:3',
  '3:2',
  '4:5',
  'auto',
  'adaptive',
  'landscape',
  'portrait',
]);
const outputQualitySchema = z.enum([
  '1k',
  '2k',
  '480p',
  '720p',
  '768p',
  '1080p',
  '4k',
  'std',
  'pro',
]);
const durationSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+)?s$/, 'Duration must use a value such as 5s or 3.5s.')
  .max(20);
const languageSchema = z.enum(['zh', 'en']);
const modelModeSchema = z.enum(['quality', 'fast', 'lite']);
const modelVariantSchema = z.enum(['standard', 'pro']);
const qualitySchema = z.enum(['standard', 'high', 'low', 'medium']);
const characterOrientationSchema = z.enum(['image', 'video']);
const backgroundSourceSchema = z.enum(['input_image', 'input_video']);
const audioRoleSchema = z.enum([
  'music',
  'voice',
  'sound_effect',
  'source_audio',
  'reference',
]);

const generationSnapshotSchema = z
  .object({
    type: z.enum(['image', 'video']),
    generationMode: generationModeSchema.optional(),
    analysisDepth: analysisDepthSchema.optional(),
    prompt: z.string().max(20_000).default(''),
    referenceCardIds: z.array(commandIdSchema).max(20).default([]),
    workflowTemplateId: commandIdSchema.nullable().default(null),
    modelId: z.string().trim().max(200).default(''),
    aspectRatio: aspectRatioSchema.default('1:1'),
    outputQuality: outputQualitySchema.default('1k'),
    duration: durationSchema.default('5s'),
    language: languageSchema.optional(),
    mode: modelModeSchema.default('quality'),
    variant: modelVariantSchema.default('standard'),
    quality: qualitySchema.default('standard'),
    characterOrientation: characterOrientationSchema.optional(),
    backgroundSource: backgroundSourceSchema.optional(),
    resultText: z.string().max(100_000).nullable().optional(),
    capturedAt: z.string().trim().min(1).max(80),
  })
  .strict();

const canvasCardCommonShape = {
  id: commandIdSchema,
  assetId: commandIdSchema.nullable().optional(),
  generationMode: generationModeSchema.optional(),
  analysisDepth: analysisDepthSchema.optional(),
  name: z.string().trim().min(1).max(500),
  url: z.string().trim().max(4096).nullable().default(null),
  resultText: z.string().max(100_000).nullable().optional(),
  prompt: z.string().max(20_000).default(''),
  referenceCardIds: z.array(commandIdSchema).max(20).default([]),
  workflowTemplateId: commandIdSchema.nullable().default(null),
  status: canvasCardStatusSchema.default('idle'),
  error: z.string().max(20_000).nullable().default(null),
  modelId: z.string().trim().max(200).default(''),
  aspectRatio: aspectRatioSchema.default('1:1'),
  outputQuality: outputQualitySchema.default('1k'),
  duration: durationSchema.default('5s'),
  language: languageSchema.optional(),
  mode: modelModeSchema.default('quality'),
  variant: modelVariantSchema.default('standard'),
  quality: qualitySchema.default('standard'),
  characterOrientation: characterOrientationSchema.optional(),
  backgroundSource: backgroundSourceSchema.optional(),
  sourceGenerationId: commandIdSchema.nullable().default(null),
  sourceConfigCardId: commandIdSchema.nullable().optional(),
  generationRunId: commandIdSchema.nullable().optional(),
  generationSnapshot: generationSnapshotSchema.nullable().optional(),
  pinnedOutputId: commandIdSchema.nullable().optional(),
  audioRole: audioRoleSchema.optional(),
  durationSec: finiteTimeSchema.nullable().optional(),
  waveformPeaks: z.array(z.number().finite().min(0).max(1)).max(256).optional(),
  timelineId: commandIdSchema.nullable().optional(),
  clipCount: z.number().int().min(0).max(10_000).nullable().optional(),
  lastRenderAssetId: commandIdSchema.nullable().optional(),
};

/**
 * Public Canvas card contract used by UI commands and MCP tool discovery.
 * Keep this explicit: an opaque `unknown` schema makes the tool impossible for
 * an Agent to call reliably even when runtime validation later succeeds.
 */
const canvasCardUnion = z.discriminatedUnion('kind', [
  z
    .object({
      ...canvasCardCommonShape,
      kind: z.literal('asset'),
      type: z.enum(['image', 'video', 'audio', 'timeline']),
    })
    .strict(),
  z
    .object({
      ...canvasCardCommonShape,
      kind: z.literal('generation'),
      type: z.enum(['image', 'video']),
    })
    .strict(),
  z
    .object({
      ...canvasCardCommonShape,
      kind: z.literal('output'),
      type: z.enum(['image', 'video']),
      sourceConfigCardId: commandIdSchema,
      generationRunId: commandIdSchema,
      generationSnapshot: generationSnapshotSchema,
    })
    .strict(),
]);

export const canvasCardSchema = z.preprocess(
  repairCanvasCardInput,
  canvasCardUnion
) as z.ZodType<CanvasCard>;

const timelineDocumentSchema = z.unknown().transform((value, context) => {
  try {
    return normalizeTimelineDocument(value);
  } catch (error) {
    context.addIssue({
      code: 'custom',
      message:
        error instanceof Error ? error.message : 'Timeline document is invalid.',
    });
    return z.NEVER;
  }
});

export const canvasOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('upsert_card'),
      card: canvasCardSchema,
      frame: frameSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('remove_card'),
      cardId: commandIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('move_card'),
      cardId: commandIdSchema,
      frame: frameSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('place_card'),
      cardId: commandIdSchema,
      sourceCardIds: z.array(commandIdSchema).max(20).optional(),
      side: z.enum(['left', 'right']).default('right'),
      offsetIndex: z.number().int().min(0).max(499).default(0),
    })
    .strict(),
  z
    .object({
      type: z.literal('set_references'),
      cardId: commandIdSchema,
      referenceCardIds: z.array(commandIdSchema).max(20),
    })
    .strict(),
  z
    .object({
      type: z.literal('upsert_timeline_node'),
      timelineId: commandIdSchema,
      name: z.string().trim().min(1).max(240),
      durationSec: finiteTimeSchema,
      clipCount: z.number().int().min(0).max(10_000),
      lastRenderAssetId: commandIdSchema.nullable().optional(),
      lastRenderUrl: z.string().trim().max(4096).nullable().optional(),
      referenceCardIds: z.array(commandIdSchema).max(20).optional(),
      frame: frameSchema.optional(),
    })
    .strict(),
]);

export const editorOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('add_clip'),
      clipId: commandIdSchema,
      assetId: commandIdSchema,
      sourceUrl: z.string().trim().max(4096).optional().default(''),
      name: z.string().trim().min(1).max(240),
      sourceType: z.enum(['image', 'video', 'audio']),
      sourceDuration: positiveDurationSchema,
      startTime: finiteTimeSchema.optional(),
      audioRole: z.enum(['music', 'voice', 'sfx', 'source']).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('add_overlay'),
      clipId: commandIdSchema,
      assetId: commandIdSchema,
      sourceUrl: z.string().trim().max(4096).optional().default(''),
      name: z.string().trim().min(1).max(240),
      startTime: finiteTimeSchema,
      duration: positiveDurationSchema,
      x: z.number().finite().min(0).max(1).optional(),
      y: z.number().finite().min(0).max(1).optional(),
      width: z.number().finite().min(0.05).max(2).optional(),
      opacity: z.number().finite().min(0).max(1).optional(),
      rotation: z.number().finite().min(-180).max(180).optional(),
      fadeIn: finiteTimeSchema.optional(),
      fadeOut: finiteTimeSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('trim_clip'),
      clipId: commandIdSchema,
      inPoint: finiteTimeSchema,
      outPoint: positiveDurationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('split_clip'),
      clipId: commandIdSchema,
      sourceTime: finiteTimeSchema,
      rightClipId: commandIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('move_clip'),
      clipId: commandIdSchema,
      startTime: finiteTimeSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('set_clip_duration'),
      clipId: commandIdSchema,
      duration: positiveDurationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('remove_clip'),
      clipId: commandIdSchema,
      ripple: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('update_audio'),
      clipId: commandIdSchema,
      patch: z
        .object({
          volume: z.number().finite().min(0).max(4).optional(),
          muted: z.boolean().optional(),
          fadeIn: finiteTimeSchema.optional(),
          fadeOut: finiteTimeSchema.optional(),
        })
        .strict()
        .refine((value) => Object.keys(value).length > 0, {
          message: 'Audio update must include at least one field.',
        }),
    })
    .strict(),
  z
    .object({
      type: z.literal('update_overlay'),
      clipId: commandIdSchema,
      patch: z
        .object({
          x: z.number().finite().min(0).max(1).optional(),
          y: z.number().finite().min(0).max(1).optional(),
          width: z.number().finite().min(0.05).max(2).optional(),
          opacity: z.number().finite().min(0).max(1).optional(),
          rotation: z.number().finite().min(-180).max(180).optional(),
          fadeIn: finiteTimeSchema.optional(),
          fadeOut: finiteTimeSchema.optional(),
        })
        .strict()
        .refine((value) => Object.keys(value).length > 0, {
          message: 'Overlay update must include at least one field.',
        }),
    })
    .strict(),
  z
    .object({
      type: z.literal('add_take'),
      clipId: commandIdSchema,
      take: z
        .object({
          id: commandIdSchema,
          assetId: commandIdSchema,
          sourceUrl: z.string().trim().max(4096).optional().default(''),
          name: z.string().trim().min(1).max(240),
          sourceDuration: positiveDurationSchema,
          sourceGenerationId: commandIdSchema.nullable(),
          prompt: z.string().max(20_000),
          createdAt: z.string().trim().min(1).max(80).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('activate_take'),
      clipId: commandIdSchema,
      takeId: commandIdSchema.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('set_render'),
      assetId: commandIdSchema,
      publicUrl: z.string().trim().max(4096).optional().default(''),
    })
    .strict(),
  z
    .object({
      type: z.literal('upsert_caption'),
      clipId: commandIdSchema,
      text: z.string().trim().min(1).max(4_000),
      startTime: finiteTimeSchema,
      duration: positiveDurationSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('import_srt'),
      srt: z.string().min(1).max(200_000),
      replace: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('set_caption_style'),
      preset: z.enum(['classic', 'bold', 'boxed', 'minimal']),
    })
    .strict(),
]);

export const beatDesignCommandSchema: z.ZodType<BeatDesignCommand> =
  z.discriminatedUnion('type', [
    z
      .object({
        type: z.literal('canvas.apply'),
        operations: z.array(canvasOperationSchema).min(1).max(500),
      })
      .strict(),
    z
      .object({
        type: z.literal('editor.apply'),
        operations: z.array(editorOperationSchema).min(1).max(500),
      })
      .strict(),
    z
      .object({
        type: z.literal('editor.replace_document'),
        document: timelineDocumentSchema,
      })
      .strict(),
    z.object({ type: z.literal('editor.validate') }).strict(),
  ]);

const commandRequestBaseSchema = z
  .object({
    commandId: commandIdSchema.optional(),
    expectedRevision: z.number().int().min(0).nullable().optional(),
    idempotencyKey: commandIdSchema.nullable().optional(),
    command: beatDesignCommandSchema,
  })
  .strict();

/**
 * Public UI requests never choose their own origin. The transport boundary
 * assigns `ui`, while MCP/CLI callers invoke the kernel through their own
 * trusted entrypoints.
 */
export const uiCommandRequestSchema = commandRequestBaseSchema;

export type ParsedUiCommandRequest = z.infer<typeof uiCommandRequestSchema>;
