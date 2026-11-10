ALTER TABLE `settings` ADD `score_plan` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `score_rules` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `score_sleep` integer DEFAULT false NOT NULL;