CREATE UNIQUE INDEX `idx_video_workflows_unique` ON `video_workflows` (`video_id`,`workflow_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_videos_url_unique` ON `videos` (`url`);