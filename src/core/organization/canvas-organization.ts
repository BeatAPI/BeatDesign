import { z } from 'zod';
import type { CanvasCard } from '../beatcanvas/canvas-types';
import { applyTemplateSlotBinding } from '../workflows/workflow-template';
import {
  arrangeGroups,
  fittedGroupFrame,
  layoutGroup,
  visibleGroupCards,
  groupCardIds,
} from './group-layout';

const id = z.string().min(1).max(200);
const title = z.string().trim().min(1).max(200);
const role = z.enum([
  'source',
  'reference',
  'style',
  'subject',
  'pose',
  'audio_track',
]);
export const canvasOrganizationFrameSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
  })
  .strict();
export type CanvasOrganizationFrame = z.infer<
  typeof canvasOrganizationFrameSchema
>;
const groupRole = z.enum([
  'shot',
  'references',
  'sound',
  'packaging',
  'timeline',
]);
export const shotGroupSchema = z
  .object({
    id,
    name: title,
    role: groupRole,
    memberCardIds: z.array(id).max(200),
    collapsed: z.boolean().default(false),
    summaryFrame: canvasOrganizationFrameSchema,
    expandedFrame: canvasOrganizationFrameSchema,
    resultCardId: id.nullable().default(null),
  })
  .strict();
export type ShotGroup = z.infer<typeof shotGroupSchema>;

export const elementBindingSchema = z
  .object({
    id,
    consumerCardId: id,
    elementId: id,
    versionId: id,
    assetId: id,
    referenceCardId: id,
    order: z.number().int().min(0).max(19),
    role,
    reviewedAgainstCurrentVersionId: id,
  })
  .strict();
export type ElementBinding = z.infer<typeof elementBindingSchema>;
export const templateSlotDefinitionSchema = z
  .object({
    id,
    label: title,
    mediaType: z.enum(['image', 'video', 'audio']),
    required: z.boolean(),
    consumers: z
      .array(
        z
          .object({
            stepId: id,
            order: z.number().int().min(0).max(19),
            role: role.optional(),
          })
          .strict()
      )
      .max(200),
  })
  .strict();
export type TemplateSlotDefinition = z.infer<
  typeof templateSlotDefinitionSchema
>;
export const templateSlotBindingSchema = z
  .object({
    assetId: id,
    referenceCardId: id,
    elementId: id.optional(),
    versionId: id.optional(),
  })
  .strict()
  .refine(
    (binding) => Boolean(binding.elementId) === Boolean(binding.versionId),
    'Element and version must be provided together.'
  );
export type TemplateSlotBinding = z.infer<typeof templateSlotBindingSchema>;
export const templateInstanceSchema = z
  .object({
    id,
    templateId: id,
    templateRevision: z.number().int().positive(),
    definitionDigest: z.string().min(1).max(200),
    creationRequestHash: z.string().min(1).max(200),
    stepCardIds: z.record(id, id),
    slotDefinitions: z.array(templateSlotDefinitionSchema).max(100),
    slotBindings: z.record(id, templateSlotBindingSchema),
    groupIds: z.array(id).max(64),
    createdAt: z.string().min(1).max(80),
  })
  .strict();
export type TemplateInstance = z.infer<typeof templateInstanceSchema>;

export const canvasOrganizationSchema = z
  .object({
    groups: z.record(id, shotGroupSchema),
    elementBindings: z.record(id, elementBindingSchema),
    templateInstances: z.record(id, templateInstanceSchema),
    view: z
      .object({
        historyMode: z.enum(['current', 'all']),
        referenceMode: z.enum(['focused', 'all']),
      })
      .strict(),
  })
  .strict();
export type CanvasOrganization = z.infer<typeof canvasOrganizationSchema>;
export type CanvasOrganizationDocument = {
  cards: CanvasCard[];
  frames: Record<string, CanvasOrganizationFrame>;
  organization?: CanvasOrganization;
};
export const createEmptyCanvasOrganization = (): CanvasOrganization => ({
  groups: {},
  elementBindings: {},
  templateInstances: {},
  view: { historyMode: 'current', referenceMode: 'focused' },
});
export function normalizeCanvasOrganization(
  value: unknown
): CanvasOrganization {
  const organization =
    value === undefined
      ? createEmptyCanvasOrganization()
      : canvasOrganizationSchema.parse(value);
  if (Object.keys(organization.groups).length > 64)
    throw new Error('Canvas supports at most 64 groups.');
  if (Object.keys(organization.templateInstances).length > 100)
    throw new Error('Canvas supports at most 100 template instances.');
  if (Object.keys(organization.elementBindings).length > 4000)
    throw new Error('Canvas Element binding limit exceeded.');
  return organization;
}

export function validateCanvasOrganization(
  document: CanvasOrganizationDocument
): CanvasOrganization {
  const organization = normalizeCanvasOrganization(document.organization);
  const cards = new Map(document.cards.map((card) => [card.id, card]));
  const membership = new Set<string>();
  for (const [key, group] of Object.entries(organization.groups)) {
    if (key !== group.id || cards.has(key))
      throw new Error('Group identity conflicts with a card or record key.');
    for (const cardId of group.memberCardIds) {
      if (!cards.has(cardId))
        throw new Error(`Unknown group member: ${cardId}`);
      if (membership.has(cardId))
        throw new Error(`Card ${cardId} belongs to more than one group.`);
      membership.add(cardId);
    }
    if (group.resultCardId && !group.memberCardIds.includes(group.resultCardId))
      throw new Error('Group result must belong to the group.');
  }
  const positions = new Set<string>();
  for (const [key, binding] of Object.entries(organization.elementBindings)) {
    const consumer = cards.get(binding.consumerCardId);
    const reference = cards.get(binding.referenceCardId);
    if (key !== binding.id || consumer?.kind !== 'generation')
      throw new Error('Element binding needs a valid generation consumer.');
    if (
      reference?.kind !== 'asset' ||
      reference.assetId !== binding.assetId ||
      !['image', 'audio'].includes(reference.type)
    )
      throw new Error(
        'Element binding asset does not match its real reference card.'
      );
    if (consumer.referenceCardIds[binding.order] !== binding.referenceCardId)
      throw new Error('Element binding reference order is inconsistent.');
    const position = `${binding.consumerCardId}:${binding.order}`;
    if (positions.has(position))
      throw new Error('Multiple Element bindings occupy the same input.');
    positions.add(position);
  }
  for (const [key, instance] of Object.entries(
    organization.templateInstances
  )) {
    if (key !== instance.id)
      throw new Error('Template instance identity mismatch.');
    const slotIds = new Set<string>();
    for (const cardId of Object.values(instance.stepCardIds))
      if (!cards.has(cardId)) throw new Error('Template step card is missing.');
    for (const groupId of instance.groupIds)
      if (!organization.groups[groupId])
        throw new Error('Template group is missing.');
    for (const slot of instance.slotDefinitions) {
      if (slotIds.has(slot.id)) throw new Error('Duplicate template slot.');
      slotIds.add(slot.id);
      for (const consumer of slot.consumers)
        if (!instance.stepCardIds[consumer.stepId])
          throw new Error('Template slot consumer step is missing.');
    }
    for (const [slotId, binding] of Object.entries(instance.slotBindings)) {
      const slot = instance.slotDefinitions.find((item) => item.id === slotId);
      const reference = cards.get(binding.referenceCardId);
      if (
        !slot ||
        reference?.kind !== 'asset' ||
        reference.assetId !== binding.assetId ||
        reference.type !== slot.mediaType
      )
        throw new Error('Template slot asset is invalid.');
      for (const consumer of slot.consumers) {
        const card = cards.get(instance.stepCardIds[consumer.stepId]);
        const omittedEarlier = instance.slotDefinitions.filter(
          (candidate) =>
            !instance.slotBindings[candidate.id] &&
            candidate.consumers.some(
              (earlier) =>
                earlier.stepId === consumer.stepId &&
                earlier.order < consumer.order
            )
        ).length;
        if (
          card?.referenceCardIds[consumer.order - omittedEarlier] !==
          binding.referenceCardId
        )
          throw new Error('Template slot reference order is inconsistent.');
      }
    }
  }
  for (const card of document.cards) {
    if (card.referenceCardIds.length > 20)
      throw new Error('A Canvas card can contain at most 20 references.');
    if (
      card.referenceCardIds.some((referenceId) =>
        Boolean(organization.groups[referenceId])
      )
    )
      throw new Error('A group cannot be a model reference.');
  }
  return organization;
}

const bindShape = {
  bindingId: id,
  consumerCardId: id,
  elementId: id,
  versionId: id,
  assetId: id,
  referenceCardId: id,
  order: z.number().int().min(0).max(19),
  role,
  reviewedAgainstCurrentVersionId: id.optional(),
};
export const canvasOrganizationOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('create_group'),
      groupId: id,
      name: title,
      role: groupRole,
      memberCardIds: z.array(id).max(200),
      collapsed: z.boolean().optional(),
      summaryFrame: canvasOrganizationFrameSchema,
      expandedFrame: canvasOrganizationFrameSchema,
      resultCardId: id.nullable().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('update_group'),
      groupId: id,
      name: title.optional(),
      role: groupRole.optional(),
      resultCardId: id.nullable().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('set_group_members'),
      groupId: id,
      memberCardIds: z.array(id).max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal('set_group_collapsed'),
      groupId: id,
      collapsed: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('move_group'),
      groupId: id,
      deltaX: z.number().finite(),
      deltaY: z.number().finite(),
    })
    .strict(),
  z
    .object({
      type: z.literal('resize_group'),
      groupId: id,
      target: z.enum(['summary', 'expanded']),
      frame: canvasOrganizationFrameSchema,
    })
    .strict(),
  z.object({ type: z.literal('remove_group'), groupId: id }).strict(),
  z
    .object({
      type: z.literal('layout_group'),
      groupId: id,
      mode: z.enum(['tidy', 'row', 'column']),
    })
    .strict(),
  z.object({ type: z.literal('fit_group'), groupId: id }).strict(),
  z
    .object({
      type: z.literal('arrange_groups'),
      groupIds: z
        .array(id)
        .min(1)
        .max(64)
        .refine(
          (ids) => new Set(ids).size === ids.length,
          'Group IDs must be unique.'
        ),
      mode: z.enum(['tidy', 'row', 'column']),
    })
    .strict(),
  z
    .object({
      type: z.literal('set_organization_view'),
      historyMode: z.enum(['current', 'all']).optional(),
      referenceMode: z.enum(['focused', 'all']).optional(),
    })
    .strict(),
  z.object({ type: z.literal('bind_element'), ...bindShape }).strict(),
  z.object({ type: z.literal('unbind_element'), bindingId: id }).strict(),
  z
    .object({
      type: z.literal('review_element_binding'),
      bindingId: id,
      observedCurrentVersionId: id,
      decision: z.enum(['keep', 'adopt']),
      binding: elementBindingSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('bind_template_slot'),
      instanceId: id,
      slotId: id,
      binding: templateSlotBindingSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('unbind_template_slot'),
      instanceId: id,
      slotId: id,
    })
    .strict(),
  z
    .object({ type: z.literal('detach_template_instance'), instanceId: id })
    .strict(),
]);
export type CanvasOrganizationOperation = z.infer<
  typeof canvasOrganizationOperationSchema
>;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export function applyCanvasOrganizationOperations<
  T extends CanvasOrganizationDocument,
>(
  source: T,
  operations: readonly CanvasOrganizationOperation[],
  options: { validate?: boolean } = {}
): {
  document: T & { organization: CanvasOrganization };
  changedIds: string[];
} {
  if (operations.length > 500)
    throw new Error('At most 500 Canvas operations per batch.');
  const document = structuredClone({
    ...source,
    organization: normalizeCanvasOrganization(source.organization),
  });
  const organization = document.organization;
  const changed = new Set<string>();
  const group = (groupId: string) => {
    const found = organization.groups[groupId];
    if (!found) throw new Error(`Unknown group: ${groupId}`);
    return found;
  };
  const replaceReference = (
    consumerId: string,
    order: number,
    referenceId: string | null,
    oldReferenceId?: string
  ) => {
    const consumer = document.cards.find((card) => card.id === consumerId);
    if (!consumer) throw new Error('Reference consumer is missing.');
    if (order > consumer.referenceCardIds.length)
      throw new Error('Reference order has an unbound gap.');
    if (referenceId) {
      if (oldReferenceId !== undefined) {
        if (consumer.referenceCardIds[order] !== oldReferenceId)
          throw new Error('Reference binding changed concurrently.');
        consumer.referenceCardIds[order] = referenceId;
      } else if (consumer.referenceCardIds[order] !== referenceId) {
        consumer.referenceCardIds.splice(order, 0, referenceId);
        for (const binding of Object.values(organization.elementBindings))
          if (binding.consumerCardId === consumerId && binding.order >= order)
            binding.order++;
      }
    } else {
      if (oldReferenceId && consumer.referenceCardIds[order] !== oldReferenceId)
        throw new Error('Reference binding changed concurrently.');
      consumer.referenceCardIds.splice(order, 1);
      for (const binding of Object.values(organization.elementBindings))
        if (binding.consumerCardId === consumerId && binding.order > order)
          binding.order--;
    }
    changed.add(consumerId);
  };
  for (const rawOperation of operations) {
    const op = canvasOrganizationOperationSchema.parse(rawOperation);
    if (op.type === 'create_group') {
      const { type: _type, groupId, ...fields } = op;
      const next = shotGroupSchema.parse({ ...fields, id: groupId });
      const existing = organization.groups[op.groupId];
      if (existing && !equal(existing, next))
        throw new Error('Group ID already exists with different content.');
      organization.groups[op.groupId] = next;
      changed.add(op.groupId);
    } else if (op.type === 'update_group') {
      const target = group(op.groupId);
      if (op.name !== undefined) target.name = op.name;
      if (op.role !== undefined) target.role = op.role;
      if (op.resultCardId !== undefined) target.resultCardId = op.resultCardId;
      changed.add(op.groupId);
    } else if (op.type === 'set_group_members') {
      const target = group(op.groupId);
      target.memberCardIds = op.memberCardIds;
      if (
        target.resultCardId &&
        !op.memberCardIds.includes(target.resultCardId)
      )
        target.resultCardId = null;
      changed.add(op.groupId);
    } else if (op.type === 'set_group_collapsed') {
      group(op.groupId).collapsed = op.collapsed;
      changed.add(op.groupId);
    } else if (op.type === 'move_group') {
      const target = group(op.groupId);
      for (const frame of [
        target.summaryFrame,
        target.expandedFrame,
        ...groupCardIds(document, target).flatMap((cardId) =>
          document.frames[cardId] ? [document.frames[cardId]] : []
        ),
      ]) {
        frame.x += op.deltaX;
        frame.y += op.deltaY;
      }
      groupCardIds(document, target).forEach((cardId) => changed.add(cardId));
      changed.add(op.groupId);
    } else if (op.type === 'resize_group') {
      const target = group(op.groupId);
      if (op.target === 'expanded') {
        for (const member of visibleGroupCards(document, target)) {
          const f = document.frames[member.id];
          if (
            f &&
            (f.x < op.frame.x ||
              f.y < op.frame.y ||
              f.x + f.w > op.frame.x + op.frame.w ||
              f.y + f.h > op.frame.y + op.frame.h)
          )
            throw new Error(
              'Expanded group bounds must contain all member bounds.'
            );
        }
      }
      target[op.target === 'summary' ? 'summaryFrame' : 'expandedFrame'] =
        op.frame;
      changed.add(op.groupId);
    } else if (op.type === 'layout_group' || op.type === 'fit_group') {
      const target = group(op.groupId);
      if (op.type === 'layout_group') layoutGroup(document, target, op.mode);
      else target.expandedFrame = fittedGroupFrame(document, target);
      groupCardIds(document, target).forEach((id) => changed.add(id));
      changed.add(target.id);
    } else if (op.type === 'arrange_groups') {
      const targets = op.groupIds.map(group);
      arrangeGroups(document, targets, op.mode);
      targets.forEach((target) => {
        changed.add(target.id);
        groupCardIds(document, target).forEach((id) => changed.add(id));
      });
    } else if (op.type === 'remove_group') {
      delete organization.groups[op.groupId];
      for (const instance of Object.values(organization.templateInstances))
        instance.groupIds = instance.groupIds.filter((id) => id !== op.groupId);
      changed.add(op.groupId);
    } else if (op.type === 'set_organization_view') {
      if (op.historyMode) organization.view.historyMode = op.historyMode;
      if (op.referenceMode) organization.view.referenceMode = op.referenceMode;
    } else if (op.type === 'bind_element') {
      const existing = organization.elementBindings[op.bindingId];
      const next: ElementBinding = {
        id: op.bindingId,
        consumerCardId: op.consumerCardId,
        elementId: op.elementId,
        versionId: op.versionId,
        assetId: op.assetId,
        referenceCardId: op.referenceCardId,
        order: op.order,
        role: op.role,
        reviewedAgainstCurrentVersionId:
          op.reviewedAgainstCurrentVersionId ?? op.versionId,
      };
      if (existing && !equal(existing, next))
        throw new Error('Binding ID already exists with different content.');
      if (!existing)
        replaceReference(next.consumerCardId, next.order, next.referenceCardId);
      organization.elementBindings[next.id] = next;
      changed.add(next.id);
    } else if (op.type === 'unbind_element') {
      const existing = organization.elementBindings[op.bindingId];
      if (existing) {
        delete organization.elementBindings[op.bindingId];
        replaceReference(
          existing.consumerCardId,
          existing.order,
          null,
          existing.referenceCardId
        );
        changed.add(op.bindingId);
      }
    } else if (op.type === 'review_element_binding') {
      const existing = organization.elementBindings[op.bindingId];
      if (!existing) throw new Error('Element binding is missing.');
      if (op.decision === 'adopt') {
        const next = op.binding;
        if (
          !next ||
          next.id !== existing.id ||
          next.consumerCardId !== existing.consumerCardId ||
          next.elementId !== existing.elementId ||
          next.order !== existing.order ||
          next.versionId !== op.observedCurrentVersionId ||
          next.reviewedAgainstCurrentVersionId !== op.observedCurrentVersionId
        )
          throw new Error(
            'Adopt needs the precise observed current version binding.'
          );
        replaceReference(
          existing.consumerCardId,
          existing.order,
          next.referenceCardId,
          existing.referenceCardId
        );
        organization.elementBindings[op.bindingId] = next;
      } else
        existing.reviewedAgainstCurrentVersionId = op.observedCurrentVersionId;
      changed.add(op.bindingId);
    } else if (op.type === 'detach_template_instance') {
      delete organization.templateInstances[op.instanceId];
      changed.add(op.instanceId);
    } else {
      const instance = organization.templateInstances[op.instanceId];
      const slot = instance?.slotDefinitions.find(
        (slot) => slot.id === op.slotId
      );
      if (!instance || !slot) throw new Error('Template slot is missing.');
      const applied = applyTemplateSlotBinding({
        cards: document.cards,
        instance,
        slotId: op.slotId,
        binding: op.type === 'bind_template_slot' ? op.binding : null,
      });
      document.cards = applied.cards;
      organization.templateInstances[op.instanceId] = applied.instance;
      // Missing earlier slots compact real input indices; maintain exact Element
      // metadata alongside those references rather than leaving stale positions.
      for (const binding of Object.values(organization.elementBindings)) {
        const consumer = document.cards.find(
          (card) => card.id === binding.consumerCardId
        );
        const order =
          consumer?.referenceCardIds.indexOf(binding.referenceCardId) ?? -1;
        if (order >= 0) binding.order = order;
      }
      for (const slot of applied.instance.slotDefinitions) {
        const value = applied.instance.slotBindings[slot.id];
        for (const consumer of slot.consumers) {
          const bindingId = `${applied.instance.id}:${slot.id}:${consumer.stepId}`;
          const previous = organization.elementBindings[bindingId];
          if (!value?.elementId || !value.versionId) {
            delete organization.elementBindings[bindingId];
            continue;
          }
          const consumerCardId = applied.instance.stepCardIds[consumer.stepId];
          const card = document.cards.find(
            (card) => card.id === consumerCardId
          );
          organization.elementBindings[bindingId] = {
            id: bindingId,
            consumerCardId,
            elementId: value.elementId,
            versionId: value.versionId,
            assetId: value.assetId,
            referenceCardId: value.referenceCardId,
            order: card!.referenceCardIds.indexOf(value.referenceCardId),
            role: consumer.role ?? 'reference',
            reviewedAgainstCurrentVersionId:
              previous?.elementId === value.elementId &&
              previous.versionId === value.versionId
                ? previous.reviewedAgainstCurrentVersionId
                : value.versionId,
          };
          changed.add(bindingId);
          changed.add(consumerCardId);
        }
      }
      changed.add(op.instanceId);
    }
  }
  if (options.validate !== false) validateCanvasOrganization(document);
  return { document, changedIds: [...changed] };
}

/** Caller removes actual cards; this function only cleans organizational metadata. */
export function cleanupCanvasOrganizationForRemovedCards<
  T extends CanvasOrganizationDocument,
>(
  source: T,
  removedIds: readonly string[] | ReadonlySet<string>
): T & { organization: CanvasOrganization } {
  const removed = new Set(removedIds);
  const document = structuredClone({
    ...source,
    organization: normalizeCanvasOrganization(source.organization),
  });
  for (const group of Object.values(document.organization.groups)) {
    group.memberCardIds = group.memberCardIds.filter((id) => !removed.has(id));
    if (group.resultCardId && removed.has(group.resultCardId))
      group.resultCardId = null;
  }
  for (const [id, binding] of Object.entries(
    document.organization.elementBindings
  )) {
    if (
      removed.has(binding.consumerCardId) ||
      removed.has(binding.referenceCardId)
    )
      delete document.organization.elementBindings[id];
    else {
      const references =
        document.cards
          .find((card) => card.id === binding.consumerCardId)
          ?.referenceCardIds.filter((id) => !removed.has(id)) ?? [];
      const order = references.indexOf(binding.referenceCardId);
      if (order >= 0) binding.order = order;
    }
  }
  for (const instance of Object.values(
    document.organization.templateInstances
  )) {
    for (const [stepId, cardId] of Object.entries(instance.stepCardIds))
      if (removed.has(cardId)) delete instance.stepCardIds[stepId];
    for (const slot of instance.slotDefinitions)
      slot.consumers = slot.consumers.filter((consumer) =>
        Boolean(instance.stepCardIds[consumer.stepId])
      );
    for (const [slotId, binding] of Object.entries(instance.slotBindings))
      if (removed.has(binding.referenceCardId))
        delete instance.slotBindings[slotId];
  }
  return document;
}
