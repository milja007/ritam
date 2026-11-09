ALTER TABLE `settings` ADD `weekend_wake_time` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `morning_notif_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `evening_notif_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `wind_down_notif_enabled` integer DEFAULT true NOT NULL;