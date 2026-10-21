import { eq, desc, sql } from 'drizzle-orm';
import { workflowTemplate } from '@/config/db/schema';
import { getDb } from '@/core/workspace-lib/db-adapter';
import { getProjectAssetById } from '@/core/workspace-lib/assets/user-assets';
import {
  loadProjectWithLatestSnapshot,
  saveProjectSnapshot,
} from '@/core/projects/projects';
import {
  normalizeProjectSnapshotDocument,
  type ProjectSnapshotDocument,
} from '@/core/projects/project-snapshot';
import { createEmptyCanvasOrganization } from '@/core/organization/canvas-organization';
import { getOrganization } from '@/core/organization/service';
import { BeatDesignCommandError } from '@/core/commands/contracts';
import type { WorkflowCommand } from '@/core/organization/command-contract';
import { listGenerationModelDescriptors } from '@/core/generation-providers/model-catalog';
import {
  captureTemplate,
  getTemplateGenerationBlockers,
  instantiateTemplate,
  templateCreationRequestHash,
  templateDefinitionDigest,
  workflowTemplateDefinitionSchema,
  type WorkflowTemplateBinding,
} from './workflow-template';

export type WorkflowInstantiationPreviewInput = Omit<
  Extract<WorkflowCommand, { type: 'workflow.template.instantiate' }>,
  'type'
>;

/** Preview and application validate exactly the same proposed Canvas. */
function assembleInstantiationCanvas(
  source: ProjectSnapshotDocument,
  draft: ReturnType<typeof instantiateTemplate>
) {
  const metadata = structuredClone(
    source.organization ?? createEmptyCanvasOrganization()
  );
  metadata.templateInstances[draft.instance.id] = draft.instance;
  for (const group of draft.groups) metadata.groups[group.id] = group;
  for (const slot of draft.instance.slotDefinitions) {
    const binding = draft.instance.slotBindings[slot.id];
    if (!binding?.elementId || !binding.versionId) continue;
    for (const consumer of slot.consumers) {
      const consumerCardId = draft.instance.stepCardIds[consumer.stepId];
      const card = draft.cards.find(
        (candidate) => candidate.id === consumerCardId
      )!;
      const order = card.referenceCardIds.indexOf(binding.referenceCardId);
      const bindingId = `${draft.instance.id}:${slot.id}:${consumer.stepId}`;
      metadata.elementBindings[bindingId] = {
        id: bindingId,
        consumerCardId,
        elementId: binding.elementId,
        versionId: binding.versionId,
        assetId: binding.assetId,
        referenceCardId: binding.referenceCardId,
        order,
        role: consumer.role ?? 'reference',
        reviewedAgainstCurrentVersionId: binding.versionId,
      };
    }
  }
  return normalizeProjectSnapshotDocument({
    ...source,
    version: 4,
    cards: [...source.cards, ...draft.cards],
    frames: { ...source.frames, ...draft.frames },
    organization: metadata,
  });
}

const conflict = (message: string, revision?: number): never => {
  throw Object.assign(
    new BeatDesignCommandError('REVISION_CONFLICT', message),
    { currentVersion: revision }
  );
};
export async function listWorkflowTemplates() {
  const db = await getDb();
  return db
    .select({
      id: workflowTemplate.id,
      name: workflowTemplate.name,
      revision: workflowTemplate.revision,
      updatedAt: workflowTemplate.updatedAt,
    })
    .from(workflowTemplate)
    .orderBy(desc(workflowTemplate.updatedAt));
}
export async function getWorkflowTemplate(templateId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(workflowTemplate)
    .where(eq(workflowTemplate.id, templateId))
    .limit(1);
  if (!row)
    throw new BeatDesignCommandError(
      'NOT_FOUND',
      'Workflow template not found'
    );
  const definition = workflowTemplateDefinitionSchema.parse(row.definitionJson);
  return {
    id: row.id,
    name: row.name,
    revision: row.revision,
    definition,
    definitionDigest: templateDefinitionDigest(definition),
  };
}
export async function previewWorkflowTemplate(
  projectId: string,
  selectedCardIds: string[]
) {
  const state = await loadProjectWithLatestSnapshot({ projectId });
  if (!state)
    throw new BeatDesignCommandError('NOT_FOUND', 'Project not found');
  const definition = captureTemplate(state.snapshot, selectedCardIds);
  return {
    definition,
    definitionDigest: templateDefinitionDigest(definition),
    sourceCanvasRevision: state.snapshotVersion,
  };
}
export async function previewWorkflowInstantiation(
  projectId: string,
  input: WorkflowInstantiationPreviewInput,
  commandId = 'preview'
) {
  const template = await getWorkflowTemplate(input.templateId);
  if (template.revision !== input.templateRevision)
    conflict('Template changed; select it again', template.revision);
  const state = await loadProjectWithLatestSnapshot({ projectId });
  if (!state)
    throw new BeatDesignCommandError('NOT_FOUND', 'Project not found');
  const organization = await getOrganization(projectId);
  const bindings: Record<string, WorkflowTemplateBinding> = {};
  for (const [slotId, binding] of Object.entries(input.bindings)) {
    const asset = await getProjectAssetById({
      projectId,
      assetId: binding.assetId,
    });
    if (!asset || !['image', 'video', 'audio'].includes(asset.type))
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Template slot requires a target-project media Asset'
      );
    if (binding.elementId || binding.versionId) {
      const element = organization.document.elements[binding.elementId ?? ''];
      if (
        !element ||
        element.deletedAt ||
        element.versions[binding.versionId ?? '']?.assetId !== asset.id
      )
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'Template Element version is unavailable'
        );
    }
    bindings[slotId] = {
      ...binding,
      mediaType: asset.type as 'image' | 'video' | 'audio',
      url: asset.publicUrl,
    };
  }
  const draft = instantiateTemplate({
    projectId,
    commandId,
    ...input,
    definition: template.definition,
    bindings,
    availableModelIds: listGenerationModelDescriptors().map(
      (model) => model.id
    ),
  });
  // A preview performs the same capacity and relational checks without saving.
  assembleInstantiationCanvas(state.snapshot, draft);
  return {
    ...draft,
    canvasRevision: state.snapshotVersion,
    organizationRevision: organization.revision,
    templateRevision: template.revision,
  };
}
export async function applyWorkflowCommand(
  projectId: string,
  commandId: string,
  command: WorkflowCommand,
  expectedRevision: number
) {
  const db = await getDb();
  const state = await loadProjectWithLatestSnapshot({ projectId });
  if (!state)
    throw new BeatDesignCommandError('NOT_FOUND', 'Project not found');
  if (command.type === 'workflow.template.capture') {
    if (expectedRevision !== 0) conflict('New template requires revision zero');
    if (state.snapshotVersion !== command.sourceCanvasRevision)
      conflict('Canvas changed since template preview', state.snapshotVersion);
    const preview = await previewWorkflowTemplate(
      projectId,
      command.selectedCardIds
    );
    if (preview.definitionDigest !== command.definitionDigest)
      conflict('Template preview changed');
    const [existing] = await db
      .select()
      .from(workflowTemplate)
      .where(eq(workflowTemplate.id, command.templateId))
      .limit(1);
    if (existing)
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Template ID already exists; choose a new ID'
      );
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTemplate);
    if (count >= 100)
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Template library limit exceeded (100)'
      );
    await db
      .insert(workflowTemplate)
      .values({
        id: command.templateId,
        name: command.name,
        definitionJson: preview.definition,
      });
    return {
      revision: 1,
      changedIds: [command.templateId],
      data: {
        templateSummary: {
          id: command.templateId,
          name: command.name,
          revision: 1,
        },
      },
    };
  }
  if (command.type === 'workflow.template.instantiate') {
    const existing =
      state.snapshot.organization?.templateInstances[command.instanceId];
    if (existing) {
      const hash = templateCreationRequestHash({
        projectId,
        commandId,
        ...command,
        definitionDigest: existing.definitionDigest,
      });
      if (existing.creationRequestHash !== hash)
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'Instance ID is already bound to another request'
        );
      const blockers = [
        ...new Set(
          Object.values(existing.stepCardIds).flatMap((cardId) =>
            getTemplateGenerationBlockers(state.snapshot, cardId)
          )
        ),
      ];
      return {
        revision: state.snapshotVersion,
        changedIds: [],
        data: { canvas: state.snapshot, instanceIds: [existing.id], blockers },
      };
    }
  }
  const template = await getWorkflowTemplate(command.templateId);
  if (
    command.type === 'workflow.template.rename' ||
    command.type === 'workflow.template.remove'
  ) {
    if (template.revision !== expectedRevision)
      conflict('Template changed; reload before saving', template.revision);
    if (command.type === 'workflow.template.remove')
      await db
        .delete(workflowTemplate)
        .where(eq(workflowTemplate.id, command.templateId));
    else
      await db
        .update(workflowTemplate)
        .set({
          name: command.name,
          revision: template.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(workflowTemplate.id, command.templateId));
    return {
      revision: template.revision + 1,
      changedIds: [template.id],
      data: {},
    };
  }
  if (state.snapshotVersion !== expectedRevision)
    conflict('Canvas changed; reload before inserting', state.snapshotVersion);
  if (template.revision !== command.templateRevision)
    conflict('Template changed; select it again', template.revision);
  const bindings: Record<string, WorkflowTemplateBinding> = {};
  const organization = await getOrganization(projectId);
  for (const [slotId, input] of Object.entries(command.bindings)) {
    const asset = await getProjectAssetById({
      projectId,
      assetId: input.assetId,
    });
    if (!asset || !['image', 'video', 'audio'].includes(asset.type))
      throw new BeatDesignCommandError(
        'INVALID_COMMAND',
        'Template slot requires a target-project media Asset'
      );
    if (input.elementId || input.versionId) {
      const element = organization.document.elements[input.elementId ?? ''];
      if (
        !element ||
        element.deletedAt ||
        element.versions[input.versionId ?? '']?.assetId !== asset.id
      )
        throw new BeatDesignCommandError(
          'INVALID_COMMAND',
          'Template Element version is unavailable'
        );
    }
    bindings[slotId] = {
      ...input,
      mediaType: asset.type as 'image' | 'video' | 'audio',
      url: asset.publicUrl,
    };
  }
  const draft = instantiateTemplate({
    projectId,
    commandId,
    instanceId: command.instanceId,
    templateId: template.id,
    templateRevision: template.revision,
    definition: template.definition,
    bindings,
    placement: command.placement,
    availableModelIds: listGenerationModelDescriptors().map(
      (model) => model.id
    ),
  });
  const canvas = assembleInstantiationCanvas(state.snapshot, draft);
  const saved = await saveProjectSnapshot({
    projectId,
    document: canvas,
    baseVersion: expectedRevision,
  });
  return {
    revision: saved.version,
    changedIds: draft.cards.map((c) => c.id),
    warnings: draft.warnings,
    data: {
      canvas,
      instanceIds: [draft.instance.id],
      blockers: draft.blockers,
    },
  };
}
