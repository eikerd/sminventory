ALTER TABLE `workflows` ADD `source` text DEFAULT 'scanned';--> statement-breakpoint
CREATE INDEX `idx_workflows_source` ON `workflows` (`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_video_urls_unique` ON `video_urls` (`video_id`,`url`);