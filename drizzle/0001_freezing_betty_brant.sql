CREATE TABLE `video_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`category` text NOT NULL,
	`value` text NOT NULL,
	`source` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_tags_video` ON `video_tags` (`video_id`);--> statement-breakpoint
CREATE INDEX `idx_video_tags_category` ON `video_tags` (`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_video_tags_unique` ON `video_tags` (`video_id`,`category`,`value`);--> statement-breakpoint
CREATE TABLE `video_urls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`source` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_urls_video` ON `video_urls` (`video_id`);--> statement-breakpoint
CREATE TABLE `video_workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`workflow_id` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_workflows_video` ON `video_workflows` (`video_id`);--> statement-breakpoint
CREATE INDEX `idx_video_workflows_workflow` ON `video_workflows` (`workflow_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`description` text,
	`channel_name` text,
	`published_at` text,
	`thumbnail_url` text,
	`duration` text,
	`cloud_render_url` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE INDEX `idx_videos_channel` ON `videos` (`channel_name`);