import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { persistBeatDesignCommand } from '@/core/commands/persist';
import {
  organizationCommandSchema,
  workflowCommandSchema,
} from '@/core/organization/command-contract';
import {
  getOrganization,
  organizationPreview,
  queryOrganizationAssets,
} from '@/core/organization/service';
import {
  getWorkflowTemplate,
  listWorkflowTemplates,
  previewWorkflowTemplate,
  previewWorkflowInstantiation,
} from '@/core/workflows/service';
import { loadProjectTimeline } from '@/core/editor/timeline-state';
import { getTimelineUsage } from '@/core/editor/timeline-usage';
import { templatePreviewInputSchema } from '@/core/workflows/template-preview-contract';

export { queryOrganizationAssets } from '@/core/organization/service';
export { requiresExplicitEnvelope } from '@/core/organization/command-contract';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};
type ErrorWrapper = <TArgs, TResult>(
  handler: (args: TArgs) => Promise<TResult> | TResult
) => (args: TArgs) => Promise<ToolResult>;
type RegistrationContext = {
  resolveScopedProject: (projectId?: string | null) => Promise<{ id: string }>;
  withToolErrors: ErrorWrapper;
};
const id = z.string().trim().min(1).max(200);
const projectScope = z.object({ projectId: id.optional() });
const explicitEnvelope = z.object({
  commandId: id,
  idempotencyKey: id,
  expectedRevision: z.number().int().nonnegative(),
});
const previewTarget = z
  .object({ folderId: id.optional(), elementId: id.optional() })
  .strict()
  .refine(
    (value) => Boolean(value.folderId) !== Boolean(value.elementId),
    'Choose one preview target'
  );

/** All MCP writes use the same persistence boundary as the browser; no conflict rebasing. */
export function registerOrganizationTools(
  server: McpServer,
  { resolveScopedProject, withToolErrors }: RegistrationContext
) {
  server.registerTool(
    'bdesign_organization_get',
    {
      description:
        'Read project folders and versioned Elements. Optionally preview removing one folder or Element without applying changes.',
      inputSchema: projectScope
        .extend({ preview: previewTarget.optional() })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, preview }) => {
      const project = await resolveScopedProject(projectId);
      const state = await getOrganization(project.id);
      return {
        ...state,
        organizationRevision: state.revision,
        ...(preview
          ? {
              preview: await organizationPreview(
                project.id,
                preview.folderId,
                preview.elementId
              ),
            }
          : {}),
      };
    })
  );
  server.registerTool(
    'bdesign_organization_apply',
    {
      description:
        'Apply project folder or Element operations atomically. Supply stable commandId/idempotencyKey and the organization revision from organization_get. Folder removal requires a matching previewRevision. Never generates or uploads media.',
      inputSchema: projectScope
        .extend(explicitEnvelope.shape)
        .extend({ operations: organizationCommandSchema.shape.operations })
        .strict(),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({ projectId, operations, ...metadata }) => {
      const project = await resolveScopedProject(projectId);
      return persistBeatDesignCommand({
        projectId: project.id,
        origin: 'mcp',
        ...metadata,
        command: { type: 'organization.apply', operations },
      });
    })
  );
  server.registerTool(
    'bdesign_asset_query',
    {
      description:
        'Search distinct project Assets using cursor pagination. scope=current with folderId=null means unclassified; project searches the entire project. Organization changes invalidate the cursor.',
      inputSchema: projectScope
        .extend({
          folderId: id.nullable().optional(),
          scope: z.enum(['current', 'project']).default('project'),
          query: z.string().max(500).default(''),
          cursor: z.string().min(1).max(8192).optional(),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, ...query }) => {
      const project = await resolveScopedProject(projectId);
      return queryOrganizationAssets(project.id, query);
    })
  );
  server.registerTool(
    'bdesign_workflow_template_list',
    {
      description:
        'List reusable workflow templates in this local installation. Reading does not instantiate or run them.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async () => listWorkflowTemplates())
  );
  server.registerTool(
    'bdesign_workflow_template_get',
    {
      description:
        'Read a local workflow template definition, exact revision and definition digest.',
      inputSchema: z.object({ templateId: id }).strict(),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ templateId }) => getWorkflowTemplate(templateId))
  );
  server.registerTool(
    'bdesign_workflow_template_preview',
    {
      description:
        'Preview capturing selected Canvas steps, or inserting an exact template revision into the selected project. Returns source revision/digest or draft blockers without writing, uploading or generating.',
      inputSchema: projectScope
        .extend({ preview: templatePreviewInputSchema })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId, preview }) => {
      const project = await resolveScopedProject(projectId);
      return 'selectedCardIds' in preview
        ? previewWorkflowTemplate(project.id, preview.selectedCardIds)
        : previewWorkflowInstantiation(project.id, preview);
    })
  );
  server.registerTool(
    'bdesign_workflow_template_apply',
    {
      description:
        'Capture, rename, remove or instantiate a workflow using shared commands. expectedRevision is zero for capture, template revision for rename/remove, Canvas revision for instantiate. Explicit IDs and revisions are required; no automatic generation.',
      inputSchema: projectScope
        .extend(explicitEnvelope.shape)
        .extend({ command: workflowCommandSchema })
        .strict(),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    withToolErrors(async ({ projectId, command, ...metadata }) => {
      const project = await resolveScopedProject(projectId);
      return persistBeatDesignCommand({
        projectId: project.id,
        origin: 'mcp',
        ...metadata,
        command,
      });
    })
  );
  server.registerTool(
    'bdesign_timeline_usage',
    {
      description:
        'Read actual Timeline media usage, active takes and source ranges. It does not follow a Canvas latest output or create an index node.',
      inputSchema: projectScope.strict(),
      annotations: { readOnlyHint: true },
    },
    withToolErrors(async ({ projectId }) => {
      const project = await resolveScopedProject(projectId);
      const timeline = await loadProjectTimeline(project.id);
      return getTimelineUsage(
        timeline?.document ?? null,
        timeline?.version ?? null
      );
    })
  );
}
