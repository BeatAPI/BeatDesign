CREATE TABLE `generation_intent_upload` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`storage_provider` text,
	`bucket` text,
	`object_key` text,
	`public_url` text,
	`filename` text,
	`mime_type` text,
	`size_bytes` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`intent_id`) REFERENCES `generation_upload_intent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generation_intent_upload_intent_idx` ON `generation_intent_upload` (`intent_id`);--> statement-breakpoint
CREATE INDEX `generation_intent_upload_status_idx` ON `generation_intent_upload` (`status`);--> statement-breakpoint
CREATE TABLE `generation_upload_intent` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`effect_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expected_upload_count` integer DEFAULT 0 NOT NULL,
	`reserved_upload_count` integer DEFAULT 0 NOT NULL,
	`completed_upload_count` integer DEFAULT 0 NOT NULL,
	`generation_id` text,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`generation_id`) REFERENCES `generation_history`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generation_upload_intent_project_idx` ON `generation_upload_intent` (`project_id`);--> statement-breakpoint
CREATE INDEX `generation_upload_intent_status_expiry_idx` ON `generation_upload_intent` (`status`,`expires_at`);