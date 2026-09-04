CREATE TABLE `model_path_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` text NOT NULL,
	`workflow_id` text,
	`execution_id` text,
	`used_path` text NOT NULL,
	`path_type` text NOT NULL,
	`success` integer NOT NULL,
	`notes` text,
	`timestamp` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`execution_id`) REFERENCES `workflow_executions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_path_history_model` ON `model_path_history` (`model_id`);--> statement-breakpoint
CREATE INDEX `idx_path_history_workflow` ON `model_path_history` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `idx_path_history_execution` ON `model_path_history` (`execution_id`);--> statement-breakpoint
CREATE INDEX `idx_path_history_timestamp` ON `model_path_history` (`timestamp`);--> statement-breakpoint
CREATE TABLE `workflow_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`completed_at` text,
	`duration_ms` integer,
	`error_message` text,
	`execution_log` text,
	`comfyui_version` text,
	`execution_profile` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_executions_workflow` ON `workflow_executions` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `idx_executions_status` ON `workflow_executions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_executions_started` ON `workflow_executions` (`started_at`);--> statement-breakpoint
ALTER TABLE `workflow_dependencies` ADD `last_validated_path` text;--> statement-breakpoint
ALTER TABLE `workflow_dependencies` ADD `last_validated_at` text;--> statement-breakpoint
ALTER TABLE `workflow_dependencies` ADD `verified_working_path` text;--> statement-breakpoint
ALTER TABLE `workflow_dependencies` ADD `last_worked_at` text;