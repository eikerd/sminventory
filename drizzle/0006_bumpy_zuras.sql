ALTER TABLE `videos` ADD `last_scan_events` text;--> statement-breakpoint
CREATE INDEX `idx_models_hash_status` ON `models` (`hash_status`);--> statement-breakpoint
CREATE INDEX `idx_models_filename` ON `models` (`filename`);--> statement-breakpoint
CREATE INDEX `idx_models_civitai_name` ON `models` (`civitai_name`);