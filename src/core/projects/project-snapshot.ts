import type {
  CanvasCard,
} from '@/core/beatcanvas/canvas-types';

export const MAX_PROJECT_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_SNAPSHOT_CARDS = 200;
const MAX_CARD_REFERENCES = 20;
const MAX_ID_CHARS = 200;
const MAX_NAME_CHARS = 500;
const MAX_PROMPT_CHARS = 20_000;
const MAX_RESULT_TEXT_CHARS = 100_000;
const MAX_URL_CHARS = 4_096;

export class ProjectSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectSnapshotValidationError';
  }
}

export const hasProjectSnapshotVersionConflict = ({
  currentVersion,
  baseVersion,
  documentChanged,
}: {
  currentVersion: number;
  baseVersion: number | null | undefined;
  documentChanged: boolean;
}) =>
  documentChanged &&
  (typeof baseVersion !== 'number' || currentVersion !== baseVersion);

export type ProjectSnapshotShapeFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ProjectSnapshotCamera = {
  x: number;
  y: number;
  z: number;
};

export type ProjectSnapshotActiveTemplateWorkflow = {
  slug: string;
  title: string;
  source: string;
  taskType: CanvasCard['type'];
  enteredAt: string;
};

export type ProjectSnapshotDocument = {
  version: 3;
  cards: CanvasCard[];
  frames: Record<string, ProjectSnapshotShapeFrame>;
  camera?: ProjectSnapshotCamera;
  workflows?: {
    activeTemplate?: ProjectSnapshotActiveTemplateWorkflow | null;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeString = (value: unknown, maxChars = MAX_NAME_CHARS) =>
  typeof value === 'string' ? value.slice(0, maxChars) : '';

const normalizeFrame = (value: unknown): ProjectSnapshotShapeFrame | null => {
  if (!isRecord(value)) {
    return null;
  }

  const x = value.x;
  const y = value.y;
  const w = value.w;
  const h = value.h;

  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(w) ||
    !isFiniteNumber(h)
  ) {
    return null;
  }
  return { x, y, w, h };
};

const normalizeCamera = (value: unknown): ProjectSnapshotCamera | null => {
  if (!isRecord(value)) {
    return null;
  }

  const x = value.x;
  const y = value.y;
  const z = value.z;

  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(z) ||
    z <= 0
  ) {
    return null;
  }

  return { x, y, z };
};

const normalizeActiveTemplateWorkflow = (
  value: unknown
): ProjectSnapshotActiveTemplateWorkflow | null => {
  if (!isRecord(value)) {
    return null;
  }

  const slug = normalizeString(value.slug);
  const title = normalizeString(value.title);
  const source = normalizeString(value.source) || 'template-library';
  const taskType = value.taskType === 'video' ? 'video' : 'image';
  const enteredAt = normalizeString(value.enteredAt);

  if (!slug || !title) {
    return null;
  }

  return {
    slug,
    title,
    source,
    taskType,
    enteredAt,
  };
};

const normalizeCard = (value: unknown): CanvasCard | null => {
  if (!isRecord(value)) {
    return null;
  }

  const referenceCardIds = Array.isArray(value.referenceCardIds)
    ? value.referenceCardIds.filter(
        (item): item is string =>
          typeof item === 'string' &&
          item.length > 0 &&
          item.length <= MAX_ID_CHARS
      ).slice(0, MAX_CARD_REFERENCES)
    : [];

  const id = typeof value.id === 'string' ? value.id : null;
  const kind = typeof value.kind === 'string' ? value.kind : null;
  const type = typeof value.type === 'string' ? value.type : null;
  const name = typeof value.name === 'string' ? value.name : null;
  const workflowTemplateId =
    typeof value.workflowTemplateId === 'string'
      ? value.workflowTemplateId
      : null;
  const modelId =
    typeof value.modelId === 'string'
      ? value.modelId
      : '';

  if (
    !id ||
    id.length > MAX_ID_CHARS ||
    !['asset', 'generation', 'output'].includes(kind || '') ||
    !['image', 'video', 'audio', 'timeline'].includes(type || '') ||
    !name ||
    name.length > MAX_NAME_CHARS
  ) {
    return null;
  }

  const sourceConfigCardId =
    typeof value.sourceConfigCardId === 'string'
      ? value.sourceConfigCardId.slice(0, MAX_ID_CHARS)
      : null;
  const generationRunId =
    typeof value.generationRunId === 'string'
      ? value.generationRunId.slice(0, MAX_ID_CHARS)
      : null;
  const generationSnapshot = isRecord(value.generationSnapshot)
    ? (value.generationSnapshot as CanvasCard['generationSnapshot'])
    : null;
  if (
    kind === 'output' &&
    (!sourceConfigCardId || !generationRunId || !generationSnapshot)
  ) {
    return null;
  }
  if (kind !== 'asset' && (type === 'audio' || type === 'timeline')) {
    return null;
  }

  return {
    id,
    assetId: typeof value.assetId === 'string' ? value.assetId : null,
    kind: kind as CanvasCard['kind'],
    type: type as CanvasCard['type'],
    generationMode:
      value.generationMode === 'analysis' ||
      value.generationMode === 'image' ||
      value.generationMode === 'video'
        ? value.generationMode
        : undefined,
    analysisDepth:
      value.analysisDepth === 'deep' || value.analysisDepth === 'standard'
        ? value.analysisDepth
        : undefined,
    name,
    url:
      typeof value.url === 'string' && value.url.length <= MAX_URL_CHARS
        ? value.url
        : null,
    resultText:
      typeof value.resultText === 'string'
        ? value.resultText.slice(0, MAX_RESULT_TEXT_CHARS)
        : null,
    prompt: normalizeString(value.prompt, MAX_PROMPT_CHARS),
    referenceCardIds,
    workflowTemplateId,
    status:
      typeof value.status === 'string'
        ? (value.status as CanvasCard['status'])
        : 'idle',
    error: typeof value.error === 'string' ? value.error : null,
    modelId,
    aspectRatio:
      typeof value.aspectRatio === 'string'
        ? (value.aspectRatio as CanvasCard['aspectRatio'])
        : '1:1',
    outputQuality:
      typeof value.outputQuality === 'string'
        ? (value.outputQuality as CanvasCard['outputQuality'])
        : '1k',
    duration:
      typeof value.duration === 'string'
        ? (value.duration as CanvasCard['duration'])
        : '5s',
    language:
      typeof value.language === 'string'
        ? (value.language as CanvasCard['language'])
        : undefined,
    mode:
      typeof value.mode === 'string'
        ? (value.mode as CanvasCard['mode'])
        : 'quality',
    variant:
      typeof value.variant === 'string'
        ? (value.variant as CanvasCard['variant'])
        : 'standard',
    quality:
      typeof value.quality === 'string'
        ? (value.quality as CanvasCard['quality'])
        : 'standard',
    characterOrientation:
      value.characterOrientation === 'image' ||
      value.characterOrientation === 'video'
        ? value.characterOrientation
        : undefined,
    backgroundSource:
      value.backgroundSource === 'input_image' ||
      value.backgroundSource === 'input_video'
        ? value.backgroundSource
        : undefined,
    sourceGenerationId:
      typeof value.sourceGenerationId === 'string'
        ? value.sourceGenerationId
        : null,
    sourceConfigCardId,
    generationRunId,
    generationSnapshot,
    pinnedOutputId:
      typeof value.pinnedOutputId === 'string' ? value.pinnedOutputId : null,
    audioRole:
      value.audioRole === 'music' ||
      value.audioRole === 'voice' ||
      value.audioRole === 'sound_effect' ||
      value.audioRole === 'source_audio' ||
      value.audioRole === 'reference'
        ? value.audioRole
        : undefined,
    durationSec: isFiniteNumber(value.durationSec)
      ? Math.max(0, value.durationSec)
      : null,
    waveformPeaks: Array.isArray(value.waveformPeaks)
      ? value.waveformPeaks
          .filter(isFiniteNumber)
          .slice(0, 256)
          .map((peak) => Math.max(0, Math.min(1, peak)))
      : undefined,
    timelineId:
      typeof value.timelineId === 'string'
        ? value.timelineId.slice(0, MAX_ID_CHARS)
        : null,
    clipCount: isFiniteNumber(value.clipCount)
      ? Math.max(0, Math.floor(value.clipCount))
      : null,
    lastRenderAssetId:
      typeof value.lastRenderAssetId === 'string'
        ? value.lastRenderAssetId.slice(0, MAX_ID_CHARS)
        : null,
  } as CanvasCard;
};

export const normalizeProjectSnapshotCard = (value: unknown) =>
  normalizeCard(value);

export const createEmptyProjectSnapshot = (): ProjectSnapshotDocument => ({
  version: 3,
  cards: [],
  frames: {},
});

export const isDestructiveEmptyProjectSnapshot = ({
  previous,
  next,
}: {
  previous: ProjectSnapshotDocument;
  next: ProjectSnapshotDocument;
}) => previous.cards.length > 0 && next.cards.length === 0;

export const normalizeProjectSnapshotDocument = (
  value: unknown
): ProjectSnapshotDocument => {
  if (!isRecord(value)) {
    return createEmptyProjectSnapshot();
  }

  if (
    Array.isArray(value.cards) &&
    value.cards.length > MAX_PROJECT_SNAPSHOT_CARDS
  ) {
    throw new ProjectSnapshotValidationError(
      `A project can contain at most ${MAX_PROJECT_SNAPSHOT_CARDS} cards.`
    );
  }

  const cards = Array.isArray(value.cards)
    ? value.cards
        .map(normalizeCard)
        .filter((item): item is CanvasCard => item !== null)
    : [];

  const framesRecord = isRecord(value.frames) ? value.frames : {};
  if (Object.keys(framesRecord).length > MAX_PROJECT_SNAPSHOT_CARDS) {
    throw new ProjectSnapshotValidationError(
      `A project can contain at most ${MAX_PROJECT_SNAPSHOT_CARDS} frames.`
    );
  }
  const cardIds = new Set(cards.map((card) => card.id));
  const frames = Object.entries(framesRecord).reduce<
    Record<string, ProjectSnapshotShapeFrame>
  >((accumulator, [cardId, frame]) => {
    const normalizedFrame = normalizeFrame(frame);
    if (normalizedFrame && cardIds.has(cardId)) {
      accumulator[cardId] = normalizedFrame;
    }
    return accumulator;
  }, {});

  const workflows = isRecord(value.workflows) ? value.workflows : {};
  const activeTemplate = normalizeActiveTemplateWorkflow(
    workflows.activeTemplate
  );
  const normalizedWorkflows = {
    ...(activeTemplate ? { activeTemplate } : {}),
  };
  const camera = normalizeCamera(value.camera);

  return {
    version: 3,
    cards,
    frames,
    ...(camera ? { camera } : {}),
    ...(Object.keys(normalizedWorkflows).length > 0
      ? {
          workflows: normalizedWorkflows,
        }
      : {}),
  };
};
