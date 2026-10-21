import { z } from 'zod';
import { organizationOperationSchema } from './organization-document';

const id = z.string().trim().min(1).max(200);
const revision = z.number().int().nonnegative();
export const organizationCommandSchema = z
  .object({
    type: z.literal('organization.apply'),
    operations: z.array(organizationOperationSchema).min(1).max(500),
  })
  .strict();
export const workflowCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('workflow.template.capture'),
      templateId: id,
      name: id,
      selectedCardIds: z.array(id).min(1).max(100),
      sourceCanvasRevision: revision,
      definitionDigest: id,
    })
    .strict(),
  z
    .object({
      type: z.literal('workflow.template.rename'),
      templateId: id,
      name: id,
    })
    .strict(),
  z
    .object({ type: z.literal('workflow.template.remove'), templateId: id })
    .strict(),
  z
    .object({
      type: z.literal('workflow.template.instantiate'),
      templateId: id,
      templateRevision: revision,
      instanceId: id,
      bindings: z
        .record(
          id,
          z
            .object({
              assetId: id,
              elementId: id.optional(),
              versionId: id.optional(),
            })
            .strict()
        )
        .default({}),
      placement: z
        .object({ x: z.number().finite(), y: z.number().finite() })
        .strict(),
    })
    .strict(),
]);
export type OrganizationCommand = z.infer<typeof organizationCommandSchema>;
export type WorkflowCommand = z.infer<typeof workflowCommandSchema>;
const legacyCanvasOps = new Set([
  'upsert_text',
  'set_camera',
  'set_workflow',
  'upsert_card',
  'remove_card',
  'move_card',
  'place_card',
  'set_references',
  'upsert_timeline_node',
]);
export function requiresExplicitEnvelope(command: {
  type: string;
  operations?: Array<{ type: string }>;
}) {
  return (
    command.type === 'organization.apply' ||
    command.type.startsWith('workflow.template.') ||
    (command.type === 'canvas.apply' &&
      !!command.operations?.some((op) => !legacyCanvasOps.has(op.type)))
  );
}
