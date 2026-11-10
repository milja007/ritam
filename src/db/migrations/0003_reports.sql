CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`period` text NOT NULL,
	`period_start` text NOT NULL,
	`sections` text NOT NULL,
	`stats` text NOT NULL,
	`prompt_version` text NOT NULL,
	`suggestion` text,
	`suggestion_accepted` integer,
	`helpful` integer,
	`feedback_comment` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_user_period_start_unique` ON `reports` (`user_id`,`period`,`period_start`);