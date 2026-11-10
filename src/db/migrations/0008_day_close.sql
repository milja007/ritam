ALTER TABLE `checkins` ADD `gave_up` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `checkins` ADD `gave_up_note` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `seen_at` text;