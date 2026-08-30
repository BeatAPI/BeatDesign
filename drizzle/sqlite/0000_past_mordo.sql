CREATE TABLE `config` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `generation_asset_link` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`generation_id`) REFERENCES `generation_history`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generation_asset_link_generation_idx` ON `generation_asset_link` (`generation_id`);--> statement-breakpoint
CREATE INDEX `generation_asset_link_asset_idx` ON `generation_asset_link` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `generation_asset_link_unique` ON `generation_asset_link` (`generation_id`,`asset_id`,`role`);--> statement-breakpoint
CREATE TABLE `generation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`effect_id` integer NOT NULL,
	`status` text NOT NULL,
	`provider_task_id` text,
	`lifecycle_phase` text,
	`last_provider_sync_at` integer,
	`execution_mode` text DEFAULT 'create_new' NOT NULL,
	`submitted_prompt` text,
	`submitted_params` text,
	`result_asset_id` text,
	`input` text,
	`output` text,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	`failed_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`result_asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generation_history_project_idx` ON `generation_history` (`project_id`);--> statement-breakpoint
CREATE INDEX `generation_history_effect_idx` ON `generation_history` (`effect_id`);--> statement-breakpoint
CREATE INDEX `generation_history_status_idx` ON `generation_history` (`status`);--> statement-breakpoint
CREATE INDEX `generation_history_provider_task_idx` ON `generation_history` (`provider_task_id`);--> statement-breakpoint
CREATE INDEX `generation_history_lifecycle_idx` ON `generation_history` (`lifecycle_phase`);--> statement-breakpoint
CREATE INDEX `generation_history_result_asset_idx` ON `generation_history` (`result_asset_id`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cover_asset_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`current_state_version` integer DEFAULT 1 NOT NULL,
	`last_workspace_mode` text DEFAULT 'canvas' NOT NULL,
	`last_opened_at` integer,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_status_idx` ON `project` (`status`);--> statement-breakpoint
CREATE INDEX `project_updated_at_idx` ON `project` (`updated_at`);--> statement-breakpoint
CREATE INDEX `project_last_opened_at_idx` ON `project` (`last_opened_at`);--> statement-breakpoint
CREATE TABLE `project_asset_membership` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`source_run_id` text,
	`category` text NOT NULL,
	`workflow_type` text,
	`workflow_instance_id` text,
	`slot_id` text,
	`role` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_run_id`) REFERENCES `generation_history`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_asset_membership_project_idx` ON `project_asset_membership` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_asset_membership_asset_idx` ON `project_asset_membership` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_asset_membership_unique` ON `project_asset_membership` (`project_id`,`asset_id`,`category`);--> statement-breakpoint
CREATE TABLE `project_canvas_state` (
	`project_id` text PRIMARY KEY NOT NULL,
	`document_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_canvas_state_updated_at_idx` ON `project_canvas_state` (`updated_at`);--> statement-breakpoint
CREATE TABLE `project_workflow_state` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`workflow_type` text NOT NULL,
	`workflow_instance_id` text NOT NULL,
	`template_slug` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`form_json` text,
	`layout_json` text,
	`selection_json` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_workflow_state_project_idx` ON `project_workflow_state` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_workflow_state_unique` ON `project_workflow_state` (`project_id`,`workflow_type`,`workflow_instance_id`);--> statement-breakpoint
CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source` text NOT NULL,
	`asset_class` text DEFAULT 'original' NOT NULL,
	`storage_provider` text,
	`bucket` text DEFAULT 'beatapi' NOT NULL,
	`object_key` text NOT NULL,
	`public_url` text NOT NULL,
	`filename` text,
	`mime_type` text,
	`size_bytes` integer,
	`sha256` text,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`origin_project_id` text,
	`thumbnail_asset_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`origin_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`thumbnail_asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `asset_type_idx` ON `asset` (`type`);--> statement-breakpoint
CREATE INDEX `asset_class_idx` ON `asset` (`asset_class`);--> statement-breakpoint
CREATE INDEX `asset_origin_project_idx` ON `asset` (`origin_project_id`);--> statement-breakpoint
CREATE INDEX `asset_created_at_idx` ON `asset` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_bucket_object_key_unique` ON `asset` (`bucket`,`object_key`);