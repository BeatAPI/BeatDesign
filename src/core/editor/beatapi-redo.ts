import {
  generateEffect,
  getEffectStatus,
  precheckEffect,
  resolveWmTaskId,
} from '@/core/effects/client-api';
import { resolveOutputMedia } from '@/core/effects/output-media';
import { uploadLocalProjectAsset } from '@/core/workspace-lib/app/local-project-asset-client';
import { GENERATION_REQUEST_VERSION } from '@/core/commands/generation-contract';

export const EDITOR_REDO_MODEL_ID = 'seedance-2';

const readAssetId = (output: unknown) => {
  if (!output || typeof output !== 'object') return null;
  const value = (output as Record<string, unknown>).assetIds;
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export async function redoTimelineSelection({
  projectId,
  file,
  prompt,
  durationSec,
  onStatus,
  precheckEffectImpl = precheckEffect,
  uploadFileImpl = uploadLocalProjectAsset,
  generateEffectImpl = generateEffect,
  getEffectStatusImpl = getEffectStatus,
  sleepImpl = sleep,
  maxAttempts = 120,
}: {
  projectId: string;
  file: File;
  prompt: string;
  durationSec: number;
  onStatus?: (status: string) => void;
  precheckEffectImpl?: typeof precheckEffect;
  uploadFileImpl?: typeof uploadLocalProjectAsset;
  generateEffectImpl?: typeof generateEffect;
  getEffectStatusImpl?: typeof getEffectStatus;
  sleepImpl?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}) {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) throw new Error('Describe how the selected clip should change.');
  const duration = `${Math.max(4, Math.min(15, Math.round(durationSec)))}s`;
  const baseInput: Record<string, unknown> = {
    prompt: trimmedPrompt,
    aspect_ratio: 'adaptive',
    wmDuration: duration,
    wmOutputQuality: '720p',
  };

  onStatus?.('validating');
  const uploaded = await uploadFileImpl({ projectId, file, assetClass: 'derived' });
  const generation = {
    version: GENERATION_REQUEST_VERSION,
    projectId,
    mode: 'video',
    modelId: EDITOR_REDO_MODEL_ID,
    prompt: trimmedPrompt,
    references: [{ assetId: uploaded.id, role: 'source' }],
    parameters: baseInput,
  };
  const precheck = await precheckEffectImpl({ generation });
  if (!precheck.ok || !precheck.data.uploadIntentToken) {
    throw new Error(precheck.data.error || 'Generation request validation failed.');
  }
  onStatus?.('submitting');
  const created = await generateEffectImpl({
    generation,
    generationIntentToken: precheck.data.uploadIntentToken,
  });
  if (!created.ok || created.data.status === 'failed') {
    throw new Error(created.data.error || 'BeatAPI generation failed.');
  }

  const generationId = resolveWmTaskId(created.data);
  let output = created.data.output;
  if (created.data.status !== 'succeeded') {
    if (!generationId) throw new Error('BeatAPI task id is missing.');
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      onStatus?.('processing');
      const status = await getEffectStatusImpl({
        wmTaskId: generationId,
        syncProvider: 1,
      });
      if (!status.ok || status.data.status === 'failed') {
        throw new Error(status.data.error || 'BeatAPI generation failed.');
      }
      output = status.data.output ?? output;
      if (status.data.status === 'succeeded') break;
      if (attempt === maxAttempts - 1) {
        throw new Error('BeatAPI generation timed out.');
      }
      await sleepImpl(5_000);
    }
  }

  const resultUrl = resolveOutputMedia(output).resultUrl;
  if (!resultUrl) throw new Error('BeatAPI completed without a video result.');
  onStatus?.('succeeded');
  return {
    resultUrl,
    assetId: readAssetId(output),
    generationId,
    output,
  };
}
