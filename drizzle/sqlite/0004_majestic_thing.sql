CREATE TABLE `project_organization_state` (
	`project_id` text PRIMARY KEY NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`document_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflow_template` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`definition_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `generation_upload_intent` ADD `source_card_id` text;--> statement-breakpoint
ALTER TABLE `generation_upload_intent` ADD `source_context_digest` text;--> statement-breakpoint
ALTER TABLE `project` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `cover_mode` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `project` ADD `settings_revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_command_receipt` ADD `request_hash` text;