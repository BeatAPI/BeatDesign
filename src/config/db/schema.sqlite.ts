/**
 * Single-user BeatDesign schema for local SQLite.
 * The workspace deliberately has no auth, billing, credits, or RBAC tables.
 */

import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const sqliteNowMs = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;
const jsonText = (name: string) => text(name, { mode: 'json' }).$type<unknown>();

export const config = sqliteTable('config', {
  name: text('name').primaryKey(),
  value: text('value'),
});

export const project = sqliteTable(
  'project',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    coverAssetId: text('cover_asset_id'),
    status: text('status').notNull().default('active'),
    currentStateVersion: integer('current_state_version').notNull().default(1),
    lastWorkspaceMode: text('last_workspace_mode').notNull().default('canvas'),
    lastOpenedAt: integer('last_opened_at', { mode: 'timestamp_ms' }),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('project_status_idx').on(table.status),
    index('project_updated_at_idx').on(table.updatedAt),
    index('project_last_opened_at_idx').on(table.lastOpenedAt),
  ]
);

export const userAsset = sqliteTable(
  'asset',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    source: text('source').notNull(),
    assetClass: text('asset_class').notNull().default('original'),
    storageProvider: text('storage_provider'),
    bucket: text('bucket').notNull().default('beatapi'),
    objectKey: text('object_key').notNull(),
    publicUrl: text('public_url').notNull(),
    filename: text('filename'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    sha256: text('sha256'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    originProjectId: text('origin_project_id').references(() => project.id, {
      onDelete: 'set null',
    }),
    thumbnailAssetId: text('thumbnail_asset_id').references(
      (): AnySQLiteColumn => userAsset.id,
      { onDelete: 'set null' }
    ),
    metadata: jsonText('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('asset_type_idx').on(table.type),
    index('asset_class_idx').on(table.assetClass),
    index('asset_origin_project_idx').on(table.originProjectId),
    index('asset_created_at_idx').on(table.createdAt),
    uniqueIndex('asset_bucket_object_key_unique').on(table.bucket, table.objectKey),
  ]
);

export const generationHistory = sqliteTable(
  'generation_history',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => project.id, {
      onDelete: 'set null',
    }),
    effectId: integer('effect_id').notNull(),
    status: text('status').notNull(),
    providerTaskId: text('provider_task_id'),
    lifecyclePhase: text('lifecycle_phase'),
    lastProviderSyncAt: integer('last_provider_sync_at', {
      mode: 'timestamp_ms',
    }),
    executionMode: text('execution_mode').notNull().default('create_new'),
    submittedPrompt: text('submitted_prompt'),
    submittedParams: jsonText('submitted_params'),
    resultAssetId: text('result_asset_id').references(
      (): AnySQLiteColumn => userAsset.id,
      { onDelete: 'set null' }
    ),
    input: jsonText('input'),
    output: jsonText('output'),
    error: text('error'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    failedAt: integer('failed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [
    index('generation_history_project_idx').on(table.projectId),
    index('generation_history_effect_idx').on(table.effectId),
    index('generation_history_status_idx').on(table.status),
    index('generation_history_provider_task_idx').on(table.providerTaskId),
    index('generation_history_lifecycle_idx').on(table.lifecyclePhase),
    index('generation_history_result_asset_idx').on(table.resultAssetId),
  ]
);

export const generationUploadIntent = sqliteTable(
  'generation_upload_intent',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    effectId: integer('effect_id').notNull(),
    status: text('status').notNull().default('pending'),
    expectedUploadCount: integer('expected_upload_count').notNull().default(0),
    reservedUploadCount: integer('reserved_upload_count').notNull().default(0),
    completedUploadCount: integer('completed_upload_count').notNull().default(0),
    generationId: text('generation_id').references(() => generationHistory.id, {
      onDelete: 'set null',
    }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('generation_upload_intent_project_idx').on(table.projectId),
    index('generation_upload_intent_status_expiry_idx').on(
      table.status,
      table.expiresAt
    ),
  ]
);

export const generationIntentUpload = sqliteTable(
  'generation_intent_upload',
  {
    id: text('id').primaryKey(),
    intentId: text('intent_id')
      .notNull()
      .references(() => generationUploadIntent.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('reserved'),
    storageProvider: text('storage_provider'),
    bucket: text('bucket'),
    objectKey: text('object_key'),
    publicUrl: text('public_url'),
    filename: text('filename'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('generation_intent_upload_intent_idx').on(table.intentId),
    index('generation_intent_upload_status_idx').on(table.status),
  ]
);

export const generationAssetLink = sqliteTable(
  'generation_asset_link',
  {
    id: text('id').primaryKey(),
    generationId: text('generation_id')
      .notNull()
      .references(() => generationHistory.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => userAsset.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [
    index('generation_asset_link_generation_idx').on(table.generationId),
    index('generation_asset_link_asset_idx').on(table.assetId),
    uniqueIndex('generation_asset_link_unique').on(
      table.generationId,
      table.assetId,
      table.role
    ),
  ]
);

export const projectCanvasState = sqliteTable(
  'project_canvas_state',
  {
    projectId: text('project_id')
      .primaryKey()
      .references(() => project.id, { onDelete: 'cascade' }),
    documentJson: jsonText('document_json').notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [index('project_canvas_state_updated_at_idx').on(table.updatedAt)]
);

export const projectTimelineState = sqliteTable(
  'project_timeline_state',
  {
    projectId: text('project_id')
      .primaryKey()
      .references(() => project.id, { onDelete: 'cascade' }),
    documentJson: jsonText('document_json').notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [index('project_timeline_state_updated_at_idx').on(table.updatedAt)]
);

export const projectCommandReceipt = sqliteTable(
  'project_command_receipt',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    commandId: text('command_id').notNull(),
    origin: text('origin').notNull(),
    commandType: text('command_type').notNull(),
    resultJson: jsonText('result_json').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [
    index('project_command_receipt_project_idx').on(table.projectId),
    index('project_command_receipt_command_idx').on(table.commandId),
    uniqueIndex('project_command_receipt_idempotency_unique').on(
      table.projectId,
      table.idempotencyKey
    ),
  ]
);

export const projectWorkflowState = sqliteTable(
  'project_workflow_state',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    workflowType: text('workflow_type').notNull(),
    workflowInstanceId: text('workflow_instance_id').notNull(),
    templateSlug: text('template_slug'),
    status: text('status').notNull().default('draft'),
    formJson: jsonText('form_json'),
    layoutJson: jsonText('layout_json'),
    selectionJson: jsonText('selection_json'),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [
    index('project_workflow_state_project_idx').on(table.projectId),
    uniqueIndex('project_workflow_state_unique').on(
      table.projectId,
      table.workflowType,
      table.workflowInstanceId
    ),
  ]
);

export const projectAssetMembership = sqliteTable(
  'project_asset_membership',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => userAsset.id, { onDelete: 'cascade' }),
    sourceRunId: text('source_run_id').references(() => generationHistory.id, {
      onDelete: 'set null',
    }),
    category: text('category').notNull(),
    workflowType: text('workflow_type'),
    workflowInstanceId: text('workflow_instance_id'),
    slotId: text('slot_id'),
    role: text('role'),
    metadata: jsonText('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [
    index('project_asset_membership_project_idx').on(table.projectId),
    index('project_asset_membership_asset_idx').on(table.assetId),
    uniqueIndex('project_asset_membership_unique').on(
      table.projectId,
      table.assetId,
      table.category
    ),
  ]
);

export type Config = typeof config.$inferSelect;
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type ProjectTimelineState = typeof projectTimelineState.$inferSelect;
export type ProjectCommandReceipt = typeof projectCommandReceipt.$inferSelect;
export type Asset = typeof userAsset.$inferSelect;
export type NewAsset = typeof userAsset.$inferInsert;
export type Generation = typeof generationHistory.$inferSelect;
export type NewGeneration = typeof generationHistory.$inferInsert;
export type GenerationUploadIntent = typeof generationUploadIntent.$inferSelect;
export type GenerationIntentUpload = typeof generationIntentUpload.$inferSelect;
