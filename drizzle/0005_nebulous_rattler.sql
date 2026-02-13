ALTER TABLE `workflows` ADD `description` text;--> statement-breakpoint
ALTER TABLE `workflows` ADD `author` text;--> statement-breakpoint
ALTER TABLE `workflows` ADD `version` text;--> statement-breakpoint
ALTER TABLE `workflows` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `workflows` ADD `steps` integer;--> statement-breakpoint
ALTER TABLE `workflows` ADD `cfg` real;--> statement-breakpoint
ALTER TABLE `workflows` ADD `scheduler` text;--> statement-breakpoint
ALTER TABLE `workflows` ADD `sampler` text;--> statement-breakpoint
ALTER TABLE `workflows` ADD `denoise` real;--> statement-breakpoint
ALTER TABLE `workflows` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `workflows` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `workflows` ADD `batch_size` integer;--> statement-breakpoint
ALTER TABLE `workflows` ADD `has_upscaler` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `workflows` ADD `has_face_detailer` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `workflows` ADD `has_controlnet` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `workflows` ADD `has_ipadapter` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `workflows` ADD `has_lora` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `workflows` ADD `node_count` integer;--> statement-breakpoint
ALTER TABLE `workflows` ADD `connection_count` integer;