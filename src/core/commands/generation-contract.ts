import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { parseLocalProjectAssetUrl } from '@/core/projects/local-project-asset-url';
import { z } from 'zod';

export const GENERATION_REQUEST_VERSION = 2 as const;

export const generationReferenceRoleSchema = z.enum([
  'source',
  'reference',
  'style',
  'subject',
  'pose',
  'audio_track',
]);

export type GenerationReferenceRole = z.infer<
  typeof generationReferenceRoleSchema
>;

export const assetFirstGenerationRequestSchema = z
  .object({
    version: z.literal(GENERATION_REQUEST_VERSION),
    projectId: z.string().min(1).max(160),
    mode: z.enum(['image', 'video', 'analysis', 'audio']),
    modelId: z.string().min(1).max(200),
    prompt: z.string().max(20_000),
    references: z
      .array(
        z.object({
          assetId: z.string().min(1).max(200),
          role: generationReferenceRoleSchema,
          deliveryUrl: z.string().trim().min(1).max(4096).optional(),
        })
          .strict()
      )
      .max(20)
      .default([]),
    parameters: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type AssetFirstGenerationRequest = z.infer<
  typeof assetFirstGenerationRequestSchema
>;

export type GenerationAssetResult = {
  generationId: string;
  assetIds: string[];
};

/**
 * Generation always produces Assets. Canvas and Editor placement is a separate
 * command so one output can be reused by multiple views without regeneration.
 */
export const normalizeAssetFirstGenerationRequest = (value: unknown) =>
  assetFirstGenerationRequestSchema.parse(value);

const resolveCardAssetId = (card: CanvasCard) =>
  card.assetId?.trim() || parseLocalProjectAssetUrl(card.url)?.assetId || null;

export function buildAssetFirstReferencesFromCanvasCards({
  cards,
  referenceCardIds,
  deliveryUrlsByCardId = {},
}: {
  cards: Record<string, CanvasCard | undefined>;
  referenceCardIds: string[];
  deliveryUrlsByCardId?: Record<string, string>;
}) {
  const mediaCards = referenceCardIds.flatMap((cardId) => {
    const card = cards[cardId];
    if (
      !card?.url ||
      (card.type !== 'image' && card.type !== 'video' && card.type !== 'audio')
    ) {
      return [];
    }
    return [card];
  });

  const references: Array<{
    assetId: string;
    role: GenerationReferenceRole;
    deliveryUrl?: string;
  }> = [];
  for (const card of mediaCards) {
    const assetId = resolveCardAssetId(card);
    if (!assetId) {
      throw new Error('Canvas generation references must be project assets.');
    }
    let role: GenerationReferenceRole = 'reference';
    if (card.type === 'video') role = 'source';
    else if (card.type === 'audio') role = 'audio_track';
    const deliveryUrl = deliveryUrlsByCardId[card.id]?.trim() || card.url?.trim();
    references.push({
      assetId,
      role,
      ...(deliveryUrl ? { deliveryUrl } : {}),
    });
  }
  return references;
}
