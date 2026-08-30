CREATE TABLE `project_command_receipt` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`command_id` text NOT NULL,
	`origin` text NOT NULL,
	`command_type` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_command_receipt_project_idx` ON `project_command_receipt` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_command_receipt_command_idx` ON `project_command_receipt` (`command_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_command_receipt_idempotency_unique` ON `project_command_receipt` (`project_id`,`idempotency_key`);