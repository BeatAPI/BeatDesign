import { createHash } from 'node:crypto';
import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { getCanvasGenerationMode } from '@/core/beatcanvas/canvas-types';
import { resolveConcreteCanvasMediaCard } from '@/core/beatcanvas/generation-history';
import { resolveCanvasTextReferences } from '@/core/beatcanvas/text-nodes';
import {
  buildAssetFirstReferencesFromCanvasCards,
  type AssetFirstGenerationRequest,
  type GenerationReferenceRole,
} from '@/core/commands/generation-contract';
import {
  getTemplateGenerationBlockers,
  type WorkflowTemplateInstance,
} from '@/core/workflows/workflow-template';
import type { ElementBinding } from './canvas-organization';
import type { ProjectOrganizationDocument } from './organization-document';
import {
  buildDraftModelParameters,
  hasModelParameter,
} from '@/core/effects/model-parameters';
import {
  getWorkspaceEffectReferenceInputDefaults,
  resolveWorkspaceEffectProviderModelVariant,
} from '@/core/effects/effect-registry';
import { VIDEO_ANALYSIS_DEFAULT_OUTPUT_TOKENS } from '@/core/effects/video-analysis';

type SourceDocument = {
  cards: CanvasCard[];
  organization?: {
    elementBindings?: Record<string, ElementBinding>;
    templateInstances?: Record<string, WorkflowTemplateInstance>;
  };
};
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)])
        )
      : value;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
type SourceModelMetadata = {
  parameterSchema: unknown;
  defaultParameters: Record<string, unknown>;
};

function reviewedParameters(
  card: Extract<CanvasCard, { kind: 'generation' }>,
  referenceTypes: string[],
  submitted: Record<string, unknown>,
  metadata?: SourceModelMetadata
) {
  const schema =
    metadata?.parameterSchema ??
    Object.fromEntries(
      [
        'aspect_ratio',
        'wmDuration',
        'wmOutputQuality',
        'quality',
        'size',
        'mode',
        'language',
        'modelVariant',
        'characterOrientation',
        'backgroundSource',
        'analysis_depth',
        'max_output_tokens',
        'sourceVideoDurationSeconds',
      ].map((key) => [key, {}])
    );
  const reviewed = buildDraftModelParameters(card, schema);
  const set = (key: string, value: unknown) => {
    if (value !== undefined && hasModelParameter(schema, key))
      reviewed[key] = value;
  };
  // These fields are also represented by reviewed Canvas controls for models that expose them.
  set('wmDuration', card.duration);
  set('mode', card.mode);
  set('size', card.quality);
  set('language', card.language);
  set(
    'modelVariant',
    resolveWorkspaceEffectProviderModelVariant({
      modelId: card.modelId,
      variant: card.variant,
    })
  );
  const referenceType = referenceTypes.includes('video')
    ? 'video'
    : referenceTypes.includes('image')
      ? 'image'
      : null;
  const referenceDefaults = getWorkspaceEffectReferenceInputDefaults({
    modelId: card.modelId,
    referenceType,
  });
  set(
    'characterOrientation',
    card.characterOrientation ?? referenceDefaults?.characterOrientation
  );
  set(
    'backgroundSource',
    card.backgroundSource ?? referenceDefaults?.backgroundSource
  );
  if (getCanvasGenerationMode(card) === 'analysis') {
    set('analysis_depth', card.analysisDepth ?? 'standard');
    set('max_output_tokens', VIDEO_ANALYSIS_DEFAULT_OUTPUT_TOKENS);
  }
  for (const [key, value] of Object.entries(metadata?.defaultParameters ?? {}))
    if (!(key in reviewed)) set(key, value);
  for (const [key, value] of Object.entries(submitted)) {
    if (
      key === 'sourceVideoDurationSeconds' &&
      hasModelParameter(schema, key)
    ) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        throw new Error('Source video duration must be finite and positive.');
      reviewed[key] = value;
    } else if (!(key in reviewed) || !same(value, reviewed[key]))
      throw new Error(
        `Generation parameter ${key} does not match the reviewed Canvas node.`
      );
  }
  return reviewed;
}

/** Pure source check, usable without loading provider configuration or creating upload intents. */
export function assertCanvasGenerationSourceDocument(
  document: SourceDocument,
  organization: ProjectOrganizationDocument,
  request: AssetFirstGenerationRequest,
  modelMetadata?: SourceModelMetadata
) {
  if (!request.sourceCardId)
    throw new Error('Canvas generation requires a sourceCardId.');
  const card = document.cards.find((item) => item.id === request.sourceCardId);
  if (!card || card.kind !== 'generation')
    throw new Error('Canvas generation source is unavailable.');
  const blockers = getTemplateGenerationBlockers(document, card.id);
  if (blockers.length) throw new Error(blockers.join(' '));
  if (
    getCanvasGenerationMode(card) !== request.mode ||
    card.modelId !== request.modelId
  )
    throw new Error(
      'Canvas generation model or mode changed; review the node again.'
    );
  if (card.prompt.trim() !== request.prompt.trim())
    throw new Error('Canvas generation prompt changed; review the node again.');
  const cardsById = Object.fromEntries(
    document.cards.map((item) => [item.id, item])
  );
  const resolvedCards = { ...cardsById };
  for (const referenceId of card.referenceCardIds) {
    const source = cardsById[referenceId];
    if (!source) throw new Error('Canvas generation reference is missing.');
    if (source.kind === 'text') continue;
    const concrete = resolveConcreteCanvasMediaCard({
      cards: cardsById,
      card: source,
    });
    if (
      !concrete?.assetId ||
      !concrete.url ||
      !['image', 'video', 'audio'].includes(concrete.type)
    )
      throw new Error(
        'Canvas generation reference has no concrete media Asset.'
      );
    resolvedCards[referenceId] = {
      ...source,
      type: concrete.type,
      url: concrete.url,
      assetId: concrete.assetId,
    } as CanvasCard;
  }
  const expectedReferences = buildAssetFirstReferencesFromCanvasCards({
    cards: resolvedCards,
    referenceCardIds: card.referenceCardIds,
  });
  const text = resolveCanvasTextReferences({
    cards: cardsById,
    referenceCardIds: card.referenceCardIds,
    prompt: card.prompt,
  });
  if (
    !same(
      expectedReferences.map(({ assetId }) => assetId),
      request.references.map(({ assetId }) => assetId)
    )
  )
    throw new Error(
      'Canvas generation references or input order changed; review the node again.'
    );
  if (!same(text.textReferences, request.textReferences ?? []))
    throw new Error('Canvas text references changed; review the node again.');

  const fixedElements: Array<{
    elementId: string;
    versionId: string;
    assetId: string;
    referenceCardId: string;
    role?: string;
    order: number;
  }> = [];
  const roleOverrides = new Map<string, GenerationReferenceRole>();
  for (const binding of Object.values(
    document.organization?.elementBindings ?? {}
  ).filter((item) => item.consumerCardId === card.id)) {
    const element = organization.elements[binding.elementId];
    const version = element?.versions[binding.versionId];
    if (
      !element ||
      element.deletedAt ||
      !version ||
      version.assetId !== binding.assetId ||
      card.referenceCardIds[binding.order] !== binding.referenceCardId ||
      cardsById[binding.referenceCardId]?.assetId !== binding.assetId
    )
      throw new Error(
        'Element reference version or binding changed; review the node again.'
      );
    fixedElements.push({
      elementId: binding.elementId,
      versionId: binding.versionId,
      assetId: binding.assetId,
      referenceCardId: binding.referenceCardId,
      role: binding.role,
      order: binding.order,
    });
    roleOverrides.set(binding.referenceCardId, binding.role);
  }
  const templateSlots: Array<{
    instanceId: string;
    templateId: string;
    templateRevision: number;
    slotId: string;
    assetId: string;
    referenceCardId: string;
    order: number;
    role?: GenerationReferenceRole;
  }> = [];
  for (const instance of Object.values(
    document.organization?.templateInstances ?? {}
  )) {
    for (const slot of instance.slotDefinitions) {
      const consumers = slot.consumers.filter(
        (consumer) => instance.stepCardIds[consumer.stepId] === card.id
      );
      const binding = instance.slotBindings[slot.id];
      if (!consumers.length || !binding) continue;
      for (const consumer of consumers) {
        if (consumer.role)
          roleOverrides.set(binding.referenceCardId, consumer.role);
        templateSlots.push({
          instanceId: instance.id,
          templateId: instance.templateId,
          templateRevision: instance.templateRevision,
          slotId: slot.id,
          assetId: binding.assetId,
          referenceCardId: binding.referenceCardId,
          order: card.referenceCardIds.indexOf(binding.referenceCardId),
          role: consumer.role,
        });
      }
      if (!binding.elementId) continue;
      const element = organization.elements[binding.elementId];
      const version = binding.versionId
        ? element?.versions[binding.versionId]
        : undefined;
      if (
        !element ||
        element.deletedAt ||
        !version ||
        version.assetId !== binding.assetId
      )
        throw new Error('Element template reference version is unavailable.');
      for (const consumer of consumers) {
        const fixed = {
          elementId: binding.elementId,
          versionId: binding.versionId!,
          assetId: binding.assetId,
          referenceCardId: binding.referenceCardId,
          role: consumer.role,
          order: card.referenceCardIds.indexOf(binding.referenceCardId),
        };
        if (!fixedElements.some((existing) => same(existing, fixed)))
          fixedElements.push(fixed);
      }
    }
  }
  fixedElements.sort(
    (left, right) =>
      left.order - right.order ||
      left.elementId.localeCompare(right.elementId) ||
      left.versionId.localeCompare(right.versionId)
  );
  templateSlots.sort(
    (left, right) =>
      left.instanceId.localeCompare(right.instanceId) ||
      left.slotId.localeCompare(right.slotId)
  );
  const mediaReferenceIds = card.referenceCardIds.filter(
    (referenceId) => cardsById[referenceId]?.kind !== 'text'
  );
  const references = request.references.map((reference, index) => {
    const referenceCardId = mediaReferenceIds[index];
    const effectiveRole =
      roleOverrides.get(referenceCardId) ?? expectedReferences[index].role;
    // Existing clients only know media-level roles. The authoritative fixed binding supplies specificity.
    if (
      reference.role !== expectedReferences[index].role &&
      reference.role !== effectiveRole
    )
      throw new Error(
        'Canvas reference role does not match its fixed binding.'
      );
    if (
      effectiveRole === 'audio_track' &&
      resolvedCards[referenceCardId].type !== 'audio'
    )
      throw new Error('An audio_track binding requires an audio Asset.');
    return { ...reference, role: effectiveRole };
  });
  const parameters = reviewedParameters(
    card,
    mediaReferenceIds.map((referenceId) => resolvedCards[referenceId].type),
    request.parameters,
    modelMetadata
  );
  const configuration = Object.fromEntries(
    [
      'type',
      'generationMode',
      'analysisDepth',
      'prompt',
      'referenceCardIds',
      'modelId',
      'aspectRatio',
      'outputQuality',
      'duration',
      'language',
      'mode',
      'variant',
      'quality',
      'characterOrientation',
      'backgroundSource',
    ].map((key) => [key, card[key as keyof CanvasCard]])
  );
  const sourceContextDigest = createHash('sha256')
    .update(
      JSON.stringify(
        canonical({
          projectId: request.projectId,
          sourceCardId: card.id,
          configuration,
          references: references.map(({ assetId, role }) => ({
            assetId,
            role,
          })),
          textReferences: text.textReferences,
          parameters,
          elementBindings: fixedElements,
          templateSlots,
        })
      )
    )
    .digest('hex');
  return {
    sourceCardId: card.id,
    sourceContextDigest,
    references,
    parameters,
    provenance: {
      sourceCardId: card.id,
      elementBindings: fixedElements,
      templateSlots,
    },
  };
}

export async function assertCanvasGenerationSource(
  projectId: string,
  sourceCardId: string,
  request: AssetFirstGenerationRequest
) {
  const [
    { loadProjectWithLatestSnapshot },
    { getOrganization },
    { getGenerationModelDescriptor },
  ] = await Promise.all([
    import('@/core/projects/projects'),
    import('./service'),
    import('@/core/generation-providers/model-catalog'),
  ]);
  const state = await loadProjectWithLatestSnapshot({ projectId });
  if (!state) throw new Error('Canvas project is unavailable.');
  const organization = await getOrganization(projectId);
  return assertCanvasGenerationSourceDocument(
    state.snapshot,
    organization.document,
    { ...request, sourceCardId },
    getGenerationModelDescriptor(request.modelId) ?? undefined
  );
}
