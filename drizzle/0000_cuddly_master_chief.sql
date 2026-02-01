CREATE TABLE `download_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text,
	`workflow_id` text,
	`dependency_id` integer,
	`model_name` text NOT NULL,
	`model_type` text NOT NULL,
	`source` text NOT NULL,
	`url` text NOT NULL,
	`destination_path` text NOT NULL,
	`expected_size` integer,
	`expected_hash` text,
	`status` text DEFAULT 'queued',
	`progress` integer DEFAULT 0,
	`downloaded_bytes` integer DEFAULT 0,
	`error_message` text,
	`resume_token` text,
	`temp_file_path` text,
	`validation_status` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dependency_id`) REFERENCES `workflow_dependencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_downloads_status` ON `download_queue` (`status`);--> statement-breakpoint
CREATE TABLE `execution_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`max_vram_gb` real NOT NULL,
	`preferred_precision` text,
	`preferred_location` text,
	`is_default` integer DEFAULT 0,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`filepath` text NOT NULL,
	`location` text NOT NULL,
	`detected_type` text,
	`detected_architecture` text,
	`detected_precision` text,
	`file_size` integer NOT NULL,
	`hash_status` text DEFAULT 'pending',
	`expected_hash` text,
	`partial_hash` text,
	`civitai_model_id` integer,
	`civitai_version_id` integer,
	`civitai_name` text,
	`civitai_base_model` text,
	`civitai_download_url` text,
	`embedded_metadata` text,
	`trigger_words` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`last_verified_at` text,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE INDEX `idx_models_location` ON `models` (`location`);--> statement-breakpoint
CREATE INDEX `idx_models_type` ON `models` (`detected_type`);--> statement-breakpoint
CREATE INDEX `idx_models_architecture` ON `models` (`detected_architecture`);--> statement-breakpoint
CREATE INDEX `idx_models_civitai` ON `models` (`civitai_model_id`);--> statement-breakpoint
CREATE TABLE `scan_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`file_count` integer,
	`total_size` integer,
	`scanned_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`encrypted` integer DEFAULT 0,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `task_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`timestamp` text DEFAULT 'CURRENT_TIMESTAMP',
	`level` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_logs_task` ON `task_logs` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_type` text NOT NULL,
	`related_id` text,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 0,
	`progress` integer DEFAULT 0,
	`current_bytes` integer DEFAULT 0,
	`total_bytes` integer DEFAULT 0,
	`current_items` integer DEFAULT 0,
	`total_items` integer DEFAULT 0,
	`speed` integer DEFAULT 0,
	`eta` integer,
	`error_message` text,
	`retry_count` integer DEFAULT 0,
	`max_retries` integer DEFAULT 3,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`started_at` text,
	`paused_at` text,
	`completed_at` text,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`cancellable` integer DEFAULT 1,
	`pausable` integer DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_type` ON `tasks` (`task_type`);--> statement-breakpoint
CREATE TABLE `workflow_dependencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow_id` text NOT NULL,
	`node_id` integer,
	`node_type` text NOT NULL,
	`model_type` text NOT NULL,
	`model_name` text NOT NULL,
	`resolved_model_id` text,
	`status` text DEFAULT 'unresolved',
	`civitai_url` text,
	`huggingface_url` text,
	`estimated_size` integer,
	`expected_architecture` text,
	`compatibility_issue` text,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_deps_workflow` ON `workflow_dependencies` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `idx_deps_status` ON `workflow_dependencies` (`status`);--> statement-breakpoint
CREATE TABLE `workflow_profile_status` (
	`workflow_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`status` text NOT NULL,
	`estimated_vram_gb` real,
	`issues` text,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `execution_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`filepath` text NOT NULL,
	`name` text,
	`status` text DEFAULT 'new',
	`total_dependencies` integer DEFAULT 0,
	`resolved_local` integer DEFAULT 0,
	`resolved_warehouse` integer DEFAULT 0,
	`missing_count` integer DEFAULT 0,
	`total_size_bytes` integer DEFAULT 0,
	`estimated_vram_gb` real,
	`raw_json` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`scanned_at` text,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE INDEX `idx_workflows_status` ON `workflows` (`status`);