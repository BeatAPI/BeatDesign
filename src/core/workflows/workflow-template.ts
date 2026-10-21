import { z } from 'zod';
import type { CanvasCard } from '@/core/beatcanvas/canvas-types';
import { buildTextCard } from '@/core/beatcanvas/text-nodes';
import type { ProjectSnapshotShapeFrame } from '@/core/projects/project-snapshot';

const id = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => !['__proto__', 'constructor', 'prototype'].includes(value),
    'Reserved identifier.'
  );
const name = z.string().trim().min(1).max(200);
const mediaType = z.enum(['image', 'video', 'audio']);
const role = z.enum([
  'source',
  'reference',
  'style',
  'subject',
  'pose',
  'audio_track',
]);
const frame = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
  })
  .strict();
const configurationSchema = z
  .object({
    type: z.enum(['text', 'image', 'video']),
    textRole: z.enum(['note', 'script', 'character', 'storyboard']).optional(),
    textContent: z.string().max(100_000).optional(),
    generationMode: z.enum(['image', 'video', 'analysis']).optional(),
    analysisDepth: z.enum(['standard', 'deep']).optional(),
    prompt: z.string().max(20_000).optional(),
    modelId: z.string().max(200).optional(),
    aspectRatio: z
      .enum([
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
      ])
      .optional(),
    outputQuality: z
      .enum(['1k', '2k', '480p', '720p', '768p', '1080p', '4k', 'std', 'pro'])
      .optional(),
    duration: z
      .string()
      .max(20)
      .regex(/^\d+(?:\.\d+)?s$/)
      .optional(),
    language: z.enum(['en', 'zh']).optional(),
    mode: z.enum(['quality', 'fast', 'lite']).optional(),
    variant: z.enum(['standard', 'pro']).optional(),
    quality: z.enum(['standard', 'high', 'low', 'medium']).optional(),
    characterOrientation: z.enum(['image', 'video']).optional(),
    backgroundSource: z.enum(['input_image', 'input_video']).optional(),
  })
  .strict();
const consumerSchema = z
  .object({
    stepId: id,
    order: z.number().int().min(0).max(19),
    role: role.optional(),
  })
  .strict();
export const workflowTemplateSlotSchema = z
  .object({
    id,
    label: name,
    mediaType,
    required: z.boolean(),
    consumers: z.array(consumerSchema).min(1).max(100),
  })
  .strict();
export type WorkflowTemplateSlot = z.infer<typeof workflowTemplateSlotSchema>;
const stepSchema = z
  .object({
    localId: id,
    name,
    kind: z.enum(['text', 'generation']),
    configuration: configurationSchema,
    frame,
  })
  .strict();
const groupSchema = z
  .object({
    localId: id,
    name,
    role: z.enum(['shot', 'references', 'sound', 'packaging', 'timeline']),
    memberStepIds: z.array(id).min(1).max(100),
    collapsed: z.boolean().default(false),
  })
  .strict();
const definitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    steps: z.array(stepSchema).min(1).max(100),
    edges: z
      .array(
        z
          .object({
            fromStepId: id,
            toStepId: id,
            order: z.number().int().min(0).max(19),
          })
          .strict()
      )
      .max(2000),
    slots: z.array(workflowTemplateSlotSchema).max(100),
    groups: z.array(groupSchema).max(64).default([]),
  })
  .strict();

export const workflowTemplateDefinitionSchema = definitionSchema.superRefine(
  (definition, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: 'custom', message });
    if (
      new TextEncoder().encode(JSON.stringify(definition)).length >
      128 * 1024
    )
      issue('Template definition exceeds 128 KiB.');
    const stepIds = new Set<string>();
    for (const step of definition.steps) {
      if (stepIds.has(step.localId)) issue('Duplicate template step ID.');
      stepIds.add(step.localId);
      if ((step.kind === 'text') !== (step.configuration.type === 'text'))
        issue('Step kind does not match its configuration type.');
    }
    const positions = new Set<string>();
    const addPosition = (stepId: string, order: number) => {
      if (!stepIds.has(stepId)) issue('Template input consumer is missing.');
      const position = `${stepId}:${order}`;
      if (positions.has(position)) issue('Template has ambiguous input order.');
      positions.add(position);
    };
    const adjacency = new Map<string, string[]>();
    for (const edge of definition.edges) {
      if (!stepIds.has(edge.fromStepId))
        issue('Template input source is missing.');
      addPosition(edge.toStepId, edge.order);
      adjacency.set(edge.fromStepId, [
        ...(adjacency.get(edge.fromStepId) ?? []),
        edge.toStepId,
      ]);
    }
    const slotIds = new Set<string>();
    for (const slot of definition.slots) {
      if (slotIds.has(slot.id)) issue('Duplicate template slot ID.');
      slotIds.add(slot.id);
      for (const consumer of slot.consumers)
        addPosition(consumer.stepId, consumer.order);
    }
    for (const stepId of stepIds) {
      const orders = [...positions]
        .filter(
          (position) => position.slice(0, position.lastIndexOf(':')) === stepId
        )
        .map((position) => Number(position.slice(stepId.length + 1)))
        .sort((a, b) => a - b);
      if (orders.some((order, index) => order !== index))
        issue('Template input order must be contiguous.');
    }
    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (stepId: string): boolean => {
      if (active.has(stepId)) return true;
      if (visited.has(stepId)) return false;
      visited.add(stepId);
      active.add(stepId);
      for (const next of adjacency.get(stepId) ?? [])
        if (visit(next)) return true;
      active.delete(stepId);
      return false;
    };
    if ([...stepIds].some(visit))
      issue('Template internal workflow contains a cycle.');
    const grouped = new Set<string>();
    const groupIds = new Set<string>();
    for (const group of definition.groups) {
      if (groupIds.has(group.localId)) issue('Duplicate template group ID.');
      groupIds.add(group.localId);
      for (const stepId of group.memberStepIds) {
        if (!stepIds.has(stepId) || grouped.has(stepId))
          issue('Invalid or multiply grouped template step.');
        grouped.add(stepId);
      }
    }
  }
);
export type WorkflowTemplateDefinition = z.infer<
  typeof workflowTemplateDefinitionSchema
>;

/** URL is derived by persistence from a destination project Asset, never taken from template data. */
export const workflowTemplateBindingSchema = z
  .object({
    assetId: id,
    mediaType,
    url: z.string().trim().min(1).max(4096),
    elementId: id.optional(),
    versionId: id.optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.elementId) === Boolean(value.versionId),
    'Element binding requires both elementId and versionId.'
  );
export type WorkflowTemplateBinding = z.infer<
  typeof workflowTemplateBindingSchema
>;

export type WorkflowTemplateInstance = {
  id: string;
  templateId: string;
  templateRevision: number;
  definitionDigest: string;
  creationRequestHash: string;
  stepCardIds: Record<string, string>;
  slotDefinitions: WorkflowTemplateSlot[];
  slotBindings: Record<
    string,
    {
      assetId: string;
      referenceCardId: string;
      elementId?: string;
      versionId?: string;
    }
  >;
  groupIds: string[];
  createdAt: string;
};
type CaptureDocument = {
  cards: CanvasCard[];
  frames: Record<string, ProjectSnapshotShapeFrame>;
  organization?: {
    groups?: Record<
      string,
      {
        id?: string;
        name: string;
        role: z.infer<typeof groupSchema>['role'];
        memberCardIds: string[];
        collapsed: boolean;
      }
    >;
    elementBindings?: Record<
      string,
      {
        consumerCardId: string;
        referenceCardId: string;
        role?: z.infer<typeof role>;
      }
    >;
  };
};

/** Stable browser-safe identity fingerprint; persistence may additionally hash the command envelope. */
function fingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(canonical)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item)
              .filter(([, child]) => child !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, canonical(child)])
          )
        : item;
  const text = JSON.stringify(canonical(value));
  const words = [2166136261, 3339675911, 217645177, 198491317];
  for (let index = 0; index < text.length; index++) {
    for (let part = 0; part < words.length; part++)
      words[part] =
        Math.imul(
          words[part] ^ (text.charCodeAt(index) + part * 31),
          16777619 + part * 2
        ) >>> 0;
  }
  return words.map((word) => word.toString(16).padStart(8, '0')).join('');
}
export const templateDefinitionDigest = (
  definition: WorkflowTemplateDefinition
) => fingerprint(workflowTemplateDefinitionSchema.parse(definition));

export function templateCreationRequestHash(input: {
  projectId: string;
  commandId: string;
  instanceId: string;
  templateId: string;
  templateRevision: number;
  definitionDigest: string;
  bindings: Record<
    string,
    { assetId: string; elementId?: string; versionId?: string }
  >;
  placement: { x: number; y: number };
}) {
  return fingerprint({
    projectId: input.projectId,
    commandId: input.commandId,
    instanceId: input.instanceId,
    templateId: input.templateId,
    templateRevision: input.templateRevision,
    definitionDigest: input.definitionDigest,
    placement: input.placement,
    bindings: Object.fromEntries(
      Object.entries(input.bindings).map(([key, binding]) => [
        key,
        {
          assetId: binding.assetId,
          ...(binding.elementId
            ? { elementId: binding.elementId, versionId: binding.versionId }
            : {}),
        },
      ])
    ),
  });
}

/** Capture semantic configuration only; historical outputs and media identities never enter a template. */
export function captureTemplate(
  document: CaptureDocument,
  selectedCardIds: string[]
): WorkflowTemplateDefinition {
  const cards = new Map(document.cards.map((card) => [card.id, card]));
  const selected = [...new Set(selectedCardIds)];
  if (selected.some((cardId) => !cards.has(cardId)))
    throw new Error('A selected template node is missing.');
  const reusable = selected
    .map((cardId) => cards.get(cardId)!)
    .filter((card) => card.kind === 'text' || card.kind === 'generation');
  if (!reusable.length)
    throw new Error('Select at least one text or generation step.');
  const localIds = new Map(
    reusable.map((card, index) => [card.id, `step-${index + 1}`])
  );
  const frames = reusable
    .map((card) => document.frames[card.id])
    .filter((value): value is ProjectSnapshotShapeFrame => Boolean(value));
  const minX = frames.length ? Math.min(...frames.map((value) => value.x)) : 0;
  const minY = frames.length ? Math.min(...frames.map((value) => value.y)) : 0;
  const steps: WorkflowTemplateDefinition['steps'] = reusable.map((card) => {
    const configuration: z.infer<typeof configurationSchema> = {
      type: card.type as 'text' | 'image' | 'video',
    };
    if (card.kind === 'text') {
      configuration.textContent = card.textContent;
      configuration.textRole = card.textRole;
    } else {
      for (const key of [
        'generationMode',
        'analysisDepth',
        'prompt',
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
      ] as const) {
        if (card[key] !== undefined)
          Object.assign(configuration, { [key]: card[key] });
      }
    }
    const sourceFrame = document.frames[card.id] ?? {
      x: minX,
      y: minY,
      w: 360,
      h: 240,
    };
    return {
      localId: localIds.get(card.id)!,
      name: card.name,
      kind: card.kind as 'text' | 'generation',
      configuration,
      frame: {
        ...sourceFrame,
        x: sourceFrame.x - minX,
        y: sourceFrame.y - minY,
      },
    };
  });
  const edges: WorkflowTemplateDefinition['edges'] = [];
  const slots: WorkflowTemplateSlot[] = [];
  const slotBySource = new Map<string, WorkflowTemplateSlot>();
  for (const card of reusable) {
    for (const [order, referenceId] of card.referenceCardIds.entries()) {
      const stepId = localIds.get(card.id)!;
      const localSource = localIds.get(referenceId);
      if (localSource) {
        edges.push({ fromStepId: localSource, toStepId: stepId, order });
        continue;
      }
      const source = cards.get(referenceId);
      if (!source) throw new Error('A template reference is missing.');
      // An unselected text reference must be explicitly selected, never coerced into media.
      if (
        source.type !== 'image' &&
        source.type !== 'video' &&
        source.type !== 'audio'
      )
        throw new Error(
          'Select referenced text steps before saving the template.'
        );
      let slot = slotBySource.get(referenceId);
      if (!slot) {
        slot = {
          id: `slot-${slots.length + 1}`,
          label: source.name.slice(0, 200),
          mediaType: source.type,
          required: true,
          consumers: [],
        };
        slots.push(slot);
        slotBySource.set(referenceId, slot);
      }
      const elementBinding = Object.values(
        document.organization?.elementBindings ?? {}
      ).find(
        (binding) =>
          binding.consumerCardId === card.id &&
          binding.referenceCardId === referenceId
      );
      slot.consumers.push({
        stepId,
        order,
        role:
          elementBinding?.role ??
          (source.type === 'video'
            ? 'source'
            : source.type === 'audio'
              ? 'audio_track'
              : 'reference'),
      });
    }
  }
  const groups: WorkflowTemplateDefinition['groups'] = [];
  for (const group of Object.values(document.organization?.groups ?? {})) {
    const memberStepIds = group.memberCardIds.flatMap((cardId) =>
      localIds.has(cardId) ? [localIds.get(cardId)!] : []
    );
    if (memberStepIds.length)
      groups.push({
        localId: `group-${groups.length + 1}`,
        name: group.name,
        role: group.role,
        memberStepIds,
        collapsed: group.collapsed,
      });
  }
  return workflowTemplateDefinitionSchema.parse({
    schemaVersion: 1,
    steps,
    edges,
    slots,
    groups,
  });
}

export type InstantiateTemplateInput = {
  projectId: string;
  commandId: string;
  instanceId: string;
  templateId: string;
  templateRevision: number;
  definition: WorkflowTemplateDefinition;
  bindings: Record<string, WorkflowTemplateBinding>;
  placement: { x: number; y: number };
  availableModelIds?: readonly string[];
  createdAt?: string;
};

export function instantiateTemplate(input: InstantiateTemplateInput) {
  for (const value of [
    input.projectId,
    input.commandId,
    input.instanceId,
    input.templateId,
  ])
    id.parse(value);
  z.number().int().positive().parse(input.templateRevision);
  z.object({ x: z.number().finite(), y: z.number().finite() })
    .strict()
    .parse(input.placement);
  const definition = workflowTemplateDefinitionSchema.parse(input.definition);
  const definitionDigest = templateDefinitionDigest(definition);
  const newId = (localId: string) =>
    `wf-${fingerprint([input.projectId, input.commandId, input.instanceId, localId])}`;
  const slotIds = new Set(definition.slots.map((slot) => slot.id));
  if (Object.keys(input.bindings).some((slotId) => !slotIds.has(slotId)))
    throw new Error('Unknown template slot binding.');
  const bindings = Object.fromEntries(
    Object.entries(input.bindings).map(([slotId, binding]) => [
      slotId,
      workflowTemplateBindingSchema.parse(binding),
    ])
  );
  const frames: Record<string, ProjectSnapshotShapeFrame> = {};
  const stepCardIds: Record<string, string> = {};
  const cards: CanvasCard[] = definition.steps.map((step) => {
    const cardId = newId(`step:${step.localId}`);
    stepCardIds[step.localId] = cardId;
    frames[cardId] = {
      ...step.frame,
      x: step.frame.x + input.placement.x,
      y: step.frame.y + input.placement.y,
    };
    const base = buildTextCard({
      id: cardId,
      name: step.name,
      textContent: step.configuration.textContent,
      textRole: step.configuration.textRole,
    });
    // The legacy field is provider-workflow metadata; installation template identity stays in the instance.
    return {
      ...base,
      ...step.configuration,
      kind: step.kind,
      workflowTemplateId: null,
    } as CanvasCard;
  });
  const byId = new Map(cards.map((card) => [card.id, card]));
  const inputs = new Map<string, Array<{ id: string; order: number }>>();
  const append = (stepId: string, cardId: string, order: number) =>
    inputs.set(stepId, [...(inputs.get(stepId) ?? []), { id: cardId, order }]);
  for (const edge of definition.edges)
    append(edge.toStepId, stepCardIds[edge.fromStepId], edge.order);
  const slotBindings: WorkflowTemplateInstance['slotBindings'] = {};
  const blockers: string[] = [];
  for (const [index, slot] of definition.slots.entries()) {
    const binding = bindings[slot.id];
    if (!binding) {
      if (slot.required)
        blockers.push(`Required reference "${slot.label}" is not bound.`);
      continue;
    }
    if (binding.mediaType !== slot.mediaType)
      throw new Error(
        `Reference type does not match template slot "${slot.label}".`
      );
    const referenceCardId = newId(`slot:${slot.id}`);
    const base = buildTextCard({ id: referenceCardId, name: slot.label });
    cards.push({
      ...base,
      kind: 'asset',
      type: binding.mediaType,
      assetId: binding.assetId,
      url: binding.url,
    });
    frames[referenceCardId] = {
      x: input.placement.x - 400,
      y: input.placement.y + index * 260,
      w: 360,
      h: 240,
    };
    slotBindings[slot.id] = {
      assetId: binding.assetId,
      referenceCardId,
      ...(binding.elementId
        ? { elementId: binding.elementId, versionId: binding.versionId }
        : {}),
    };
    for (const consumer of slot.consumers)
      append(consumer.stepId, referenceCardId, consumer.order);
  }
  for (const [stepId, references] of inputs)
    byId.get(stepCardIds[stepId])!.referenceCardIds = references
      .sort((a, b) => a.order - b.order)
      .map((reference) => reference.id);
  const groups = definition.groups.map((group) => {
    const memberCardIds = group.memberStepIds.map(
      (stepId) => stepCardIds[stepId]
    );
    const boxes = memberCardIds.map((cardId) => frames[cardId]);
    const x = Math.min(...boxes.map((box) => box.x)) - 24;
    const y = Math.min(...boxes.map((box) => box.y)) - 48;
    const expandedFrame = {
      x,
      y,
      w: Math.max(...boxes.map((box) => box.x + box.w)) - x + 24,
      h: Math.max(...boxes.map((box) => box.y + box.h)) - y + 24,
    };
    return {
      id: newId(`group:${group.localId}`),
      name: group.name,
      role: group.role,
      memberCardIds,
      collapsed: group.collapsed,
      summaryFrame: { x, y, w: 360, h: 180 },
      expandedFrame,
      resultCardId: null,
    };
  });
  const instance: WorkflowTemplateInstance = {
    id: input.instanceId,
    templateId: input.templateId,
    templateRevision: input.templateRevision,
    definitionDigest,
    creationRequestHash: templateCreationRequestHash({
      projectId: input.projectId,
      commandId: input.commandId,
      instanceId: input.instanceId,
      templateId: input.templateId,
      templateRevision: input.templateRevision,
      definitionDigest,
      bindings,
      placement: input.placement,
    }),
    stepCardIds,
    slotDefinitions: definition.slots,
    slotBindings,
    groupIds: groups.map((group) => group.id),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const available = input.availableModelIds
    ? new Set(input.availableModelIds)
    : null;
  const warnings = available
    ? definition.steps
        .filter(
          (step) =>
            step.kind === 'generation' &&
            !available.has(step.configuration.modelId ?? '')
        )
        .map(
          (step) =>
            `Model "${step.configuration.modelId ?? ''}" is unavailable for "${step.name}".`
        )
    : [];
  return { cards, frames, instance, groups, blockers, warnings };
}

/** Bind/unbind a slot without losing logical input positions when earlier slots are still empty. */
export function applyTemplateSlotBinding({
  cards,
  instance,
  slotId,
  binding,
}: {
  cards: CanvasCard[];
  instance: WorkflowTemplateInstance;
  slotId: string;
  binding: WorkflowTemplateInstance['slotBindings'][string] | null;
}): { cards: CanvasCard[]; instance: WorkflowTemplateInstance } {
  const slot = instance.slotDefinitions.find(
    (candidate) => candidate.id === slotId
  );
  if (!slot) throw new Error('Unknown template slot binding.');
  if (binding) {
    const asset = cards.find((card) => card.id === binding.referenceCardId);
    if (
      !asset ||
      asset.kind !== 'asset' ||
      asset.assetId !== binding.assetId ||
      asset.type !== slot.mediaType ||
      !asset.url
    )
      throw new Error(
        'Template slot requires an existing real Asset card of the correct type.'
      );
  }
  const slotBindings = { ...instance.slotBindings };
  if (binding) slotBindings[slotId] = { ...binding };
  else delete slotBindings[slotId];
  const changedStepIds = new Set(
    slot.consumers.map((consumer) => consumer.stepId)
  );
  const oldReferenceIds = new Set(
    Object.values(instance.slotBindings).map((value) => value.referenceCardId)
  );
  // New references may already have been placed by the caller; do not treat them as internal edges.
  if (binding) oldReferenceIds.add(binding.referenceCardId);
  const nextCards = cards.map((card) => {
    const stepId = Object.entries(instance.stepCardIds).find(
      ([, cardId]) => cardId === card.id
    )?.[0];
    if (!stepId || !changedStepIds.has(stepId)) return card;
    const internalReferences = card.referenceCardIds.filter(
      (referenceId) => !oldReferenceIds.has(referenceId)
    );
    const slotPositions = new Map<number, string | null>();
    for (const definition of instance.slotDefinitions) {
      for (const consumer of definition.consumers)
        if (consumer.stepId === stepId)
          slotPositions.set(
            consumer.order,
            slotBindings[definition.id]?.referenceCardId ?? null
          );
    }
    const references: string[] = [];
    const positionCount = Math.max(
      internalReferences.length + slotPositions.size,
      ...[...slotPositions.keys()].map((order) => order + 1)
    );
    for (let order = 0; order < positionCount; order++) {
      if (slotPositions.has(order)) {
        const referenceId = slotPositions.get(order);
        if (referenceId) references.push(referenceId);
      } else {
        const referenceId = internalReferences.shift();
        if (referenceId) references.push(referenceId);
      }
    }
    references.push(...internalReferences);
    if (references.length > 20)
      throw new Error('A template consumer supports at most 20 references.');
    return { ...card, referenceCardIds: references };
  });
  return { cards: nextCards, instance: { ...instance, slotBindings } };
}

/** Required slots are checked per consuming node, not across unrelated steps in the same workflow. */
export function getTemplateGenerationBlockers(
  document: {
    cards: CanvasCard[];
    organization?: {
      templateInstances?: Record<string, WorkflowTemplateInstance>;
    };
  },
  sourceCardId: string
): string[] {
  const cards = new Map(document.cards.map((card) => [card.id, card]));
  const blockers: string[] = [];
  for (const instance of Object.values(
    document.organization?.templateInstances ?? {}
  )) {
    const localIds = new Set(
      Object.entries(instance.stepCardIds)
        .filter(([, cardId]) => cardId === sourceCardId)
        .map(([stepId]) => stepId)
    );
    if (!localIds.size) continue;
    const consumerCard = cards.get(sourceCardId);
    if (!consumerCard) {
      blockers.push('Template generation node is missing.');
      continue;
    }
    for (const slot of instance.slotDefinitions) {
      if (
        !slot.required ||
        !slot.consumers.some((consumer) => localIds.has(consumer.stepId))
      )
        continue;
      const binding = instance.slotBindings[slot.id];
      const card = binding ? cards.get(binding.referenceCardId) : undefined;
      const consumers = slot.consumers.filter((consumer) =>
        localIds.has(consumer.stepId)
      );
      const orderMatches = consumers.every((consumer) => {
        const omittedBefore = instance.slotDefinitions.reduce(
          (count, other) =>
            count +
            other.consumers.filter(
              (item) =>
                item.stepId === consumer.stepId &&
                item.order < consumer.order &&
                !instance.slotBindings[other.id]
            ).length,
          0
        );
        return (
          consumerCard.referenceCardIds[consumer.order - omittedBefore] ===
          card?.id
        );
      });
      if (
        !binding ||
        !card ||
        card.kind !== 'asset' ||
        card.type !== slot.mediaType ||
        card.assetId !== binding.assetId ||
        !card.url ||
        !orderMatches
      )
        blockers.push(
          `Required reference "${slot.label}" is not bound to a valid input.`
        );
    }
  }
  return blockers;
}
