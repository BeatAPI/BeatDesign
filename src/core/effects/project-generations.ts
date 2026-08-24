import { desc, eq } from 'drizzle-orm';

import { generationHistory } from '@/config/db/schema';
import { getWorkspaceEffectRegistryEntryByEffectId } from '@/core/effects/effect-registry';
import { resolveOutputMedia } from '@/core/effects/output-media';
import {
  isVideoAnalysisEffectId,
  resolveVideoAnalysisText,
} from '@/core/effects/video-analysis';
import { getDb } from '@/core/workspace-lib/db-adapter';

import type { GenerationStatus } from './record-generation';

export type ProjectGenerationItem = {
  id: string;
  status: GenerationStatus;
  prompt: string | null;
  modelId: string | null;
  modelName: string | null;
  mediaType: 'image' | 'video' | 'analysis';
  resultUrl: string | null;
  resultText: string | null;
  paramsLabel: string | null;
  aspectRatio: string | null;
  outputQuality: string | null;
  mode: string | null;
  duration: string | null;
  referenceImages: string[];
  referenceVideos: string[];
  error: string | null;
  createdAt: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const readUrlList = (...values: unknown[]) => {
  const urls: string[] = [];
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      urls.push(value.trim());
      continue;
    }
    if (Array.isArray(value)) {
      urls.push(
        ...value.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim())
        ).map((item) => item.trim())
      );
    }
  }
  return [...new Set(urls)];
};

const formatParamsLabel = (input: Record<string, unknown> | null) => {
  if (!input) return null;
  const mode =
    input.mode === 'fast'
      ? 'Fast'
      : input.mode === 'lite'
        ? 'Lite'
        : input.mode === 'quality'
          ? 'Quality'
          : null;
  const duration = readString(input.wmDuration);
  const aspectRatio = readString(input.aspect_ratio);
  const quality = readString(input.wmOutputQuality)?.toUpperCase() ?? null;
  const parts = [
    mode,
    duration,
    aspectRatio,
    quality,
  ].filter(
    (value): value is string => Boolean(value)
  );
  return parts.length > 0 ? parts.join(' · ') : null;
};

type ProjectGenerationRow = {
  id: string;
  status: string;
  submittedPrompt: string | null;
  effectId: number;
  input: unknown;
  output: unknown;
  error: string | null;
  createdAt: Date | string;
};

export const toProjectGenerationItem = (
  row: ProjectGenerationRow
): ProjectGenerationItem => {
  const entry = getWorkspaceEffectRegistryEntryByEffectId(row.effectId);
  const isAnalysis = isVideoAnalysisEffectId(row.effectId);
  const input = asRecord(row.input);
  const media = resolveOutputMedia(row.output);
  const analysisModelName =
    input?.analysis_depth === 'deep'
      ? 'Video Analysis Pro'
      : 'Video Analysis Standard';
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : new Date(row.createdAt).toISOString();

  return {
    id: row.id,
    status: row.status as GenerationStatus,
    prompt: row.submittedPrompt,
    modelId:
      readString(input?.model) ?? entry?.id ?? (isAnalysis ? 'video-analysis' : null),
    modelName: entry?.name ?? (isAnalysis ? analysisModelName : null),
    mediaType: isAnalysis
      ? 'analysis'
      : entry?.workspaceType === 'ai-image'
        ? 'image'
        : 'video',
    resultUrl: media.resultUrl,
    resultText: resolveVideoAnalysisText(row.output),
    paramsLabel: formatParamsLabel(input),
    aspectRatio: readString(input?.aspect_ratio),
    outputQuality: readString(input?.wmOutputQuality),
    mode: readString(input?.mode),
    duration: readString(input?.wmDuration),
    referenceImages: readUrlList(
      input?.image_urls,
      input?.image_url,
      input?.last_frame
    ),
    referenceVideos: readUrlList(input?.video_urls, input?.video_url),
    error: row.error,
    createdAt,
  };
};

export const toChronologicalProjectGenerationItems = (
  newestFirstRows: ProjectGenerationRow[]
) => [...newestFirstRows].reverse().map(toProjectGenerationItem);

export async function listProjectGenerations(projectId: string, limit = 80) {
  const db = await getDb();
  const rows = await db
    .select({
      id: generationHistory.id,
      status: generationHistory.status,
      submittedPrompt: generationHistory.submittedPrompt,
      effectId: generationHistory.effectId,
      input: generationHistory.input,
      output: generationHistory.output,
      error: generationHistory.error,
      createdAt: generationHistory.createdAt,
    })
    .from(generationHistory)
    .where(eq(generationHistory.projectId, projectId))
    .orderBy(desc(generationHistory.createdAt))
    .limit(limit);

  return toChronologicalProjectGenerationItems(rows);
}
