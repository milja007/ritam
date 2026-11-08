CREATE TABLE `checkin_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`checkin_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text,
	`ok` integer NOT NULL,
	`comment` text,
	FOREIGN KEY (`checkin_id`) REFERENCES `checkins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checkin_items_checkin_idx` ON `checkin_items` (`checkin_id`);--> statement-breakpoint
CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`sleep_start` text,
	`wake_time` text,
	`mood` integer,
	`day_rating` integer,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `checkins_user_date_idx` ON `checkins` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `rule_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`rule_id` text NOT NULL,
	`date` text NOT NULL,
	`kept` integer NOT NULL,
	`trigger` text,
	`checkin_id` text,
	FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`checkin_id`) REFERENCES `checkins`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rule_logs_rule_date_idx` ON `rule_logs` (`rule_id`,`date`);--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`title` text NOT NULL,
	`icon` text,
	`active_days` text NOT NULL,
	`active_hours` text,
	`why` text NOT NULL,
	`weight` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rules_user_idx` ON `rules` (`user_id`);--> statement-breakpoint
CREATE TABLE `schedule_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`task_id` text,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedule_blocks_user_date_idx` ON `schedule_blocks` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`language` text NOT NULL,
	`wake_time` text NOT NULL,
	`sleep_hours` real NOT NULL,
	`morning_notif_time` text NOT NULL,
	`evening_notif_time` text NOT NULL,
	`wind_down_minutes` integer NOT NULL,
	`theme` text NOT NULL,
	`google_calendar_connected` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_user_id_unique` ON `settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`amount` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `xp_events_user_date_idx` ON `xp_events` (`user_id`,`date`);