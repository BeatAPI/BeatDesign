CREATE TABLE `project_timeline_state` (
	`project_id` text PRIMARY KEY NOT NULL,
	`document_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_timeline_state_updated_at_idx` ON `project_timeline_state` (`updated_at`);