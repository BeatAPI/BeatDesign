import { normalizeProjectSnapshotCard } from '@/core/projects/project-snapshot';

const ASPECT_RATIOS = new Set([
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
const OUTPUT_QUALITIES = new Set([
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
const STATUSES = new Set([
  'idle',
  'pending',
  'processing',
  'succeeded',
  'failed',
]);
const MODES = new Set(['quality', 'fast', 'lite']);
const VARIANTS = new Set(['standard', 'pro']);
const QUALITIES = new Set(['standard', 'high', 'low', 'medium']);
const LANGUAGES = new Set(['zh', 'en']);

const pick = (value: unknown, allowed: Set<string>, fallback: string) =>
  typeof value === 'string' && allowed.has(value) ? value : fallback;

const optionalPick = (value: unknown, allowed: Set<string>) =>
  typeof value === 'string' && allowed.has(value) ? value : undefined;

export const coerceCanvasDuration = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return `${value}s`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+(?:\.\d+)?s$/.test(trimmed)) return trimmed;
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) return `${parsed}s`;
  }
  return '5s';
};

export function repairCanvasCardInput(value: unknown) {
  const card = normalizeProjectSnapshotCard(value);
  if (!card) return value;
  const duration = coerceCanvasDuration(card.duration);
  const name = card.name.trim() || 'Untitled';
  const language = optionalPick(card.language, LANGUAGES);
  const generationSnapshot = card.generationSnapshot
    ? {
        type: card.generationSnapshot.type === 'video' ? 'video' : 'image',
        generationMode: card.generationSnapshot.generationMode,
        analysisDepth: card.generationSnapshot.analysisDepth,
        prompt: card.generationSnapshot.prompt,
        referenceCardIds: card.generationSnapshot.referenceCardIds,
        workflowTemplateId: card.generationSnapshot.workflowTemplateId,
        modelId: card.generationSnapshot.modelId,
        aspectRatio: pick(
          card.generationSnapshot.aspectRatio,
          ASPECT_RATIOS,
          '1:1'
        ),
        outputQuality: pick(
          card.generationSnapshot.outputQuality,
          OUTPUT_QUALITIES,
          '1k'
        ),
        duration: coerceCanvasDuration(card.generationSnapshot.duration),
        language: optionalPick(card.generationSnapshot.language, LANGUAGES),
        mode: pick(card.generationSnapshot.mode, MODES, 'quality'),
        variant: pick(card.generationSnapshot.variant, VARIANTS, 'standard'),
        quality: pick(card.generationSnapshot.quality, QUALITIES, 'standard'),
        characterOrientation: card.generationSnapshot.characterOrientation,
        backgroundSource: card.generationSnapshot.backgroundSource,
        resultText: card.generationSnapshot.resultText,
        capturedAt:
          typeof card.generationSnapshot.capturedAt === 'string' &&
          card.generationSnapshot.capturedAt.trim()
            ? card.generationSnapshot.capturedAt
            : new Date().toISOString(),
      }
    : card.kind === 'output'
      ? {
          type: card.type === 'video' ? 'video' : 'image',
          prompt: card.prompt,
          referenceCardIds: card.referenceCardIds,
          workflowTemplateId: card.workflowTemplateId,
          modelId: card.modelId,
          aspectRatio: pick(card.aspectRatio, ASPECT_RATIOS, '1:1'),
          outputQuality: pick(card.outputQuality, OUTPUT_QUALITIES, '1k'),
          duration,
          language,
          mode: pick(card.mode, MODES, 'quality'),
          variant: pick(card.variant, VARIANTS, 'standard'),
          quality: pick(card.quality, QUALITIES, 'standard'),
          capturedAt: new Date().toISOString(),
        }
      : card.generationSnapshot;
  return {
    ...card,
    name,
    duration,
    language,
    status: pick(card.status, STATUSES, 'idle'),
    aspectRatio: pick(card.aspectRatio, ASPECT_RATIOS, '1:1'),
    outputQuality: pick(card.outputQuality, OUTPUT_QUALITIES, '1k'),
    mode: pick(card.mode, MODES, 'quality'),
    variant: pick(card.variant, VARIANTS, 'standard'),
    quality: pick(card.quality, QUALITIES, 'standard'),
    generationSnapshot,
    sourceConfigCardId:
      card.kind === 'output'
        ? card.sourceConfigCardId || card.id
        : card.sourceConfigCardId,
    generationRunId:
      card.kind === 'output'
        ? card.generationRunId || card.id
        : card.generationRunId,
  };
}
