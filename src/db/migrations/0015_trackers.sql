-- Korak 31b: opcionalni trackeri kalorija i novca. Okidači reda za sync kao u 0009_sync.
CREATE TABLE `tracker_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tracker_entries_user_date_idx` ON `tracker_entries` (`user_id`,`date`);--> statement-breakpoint
ALTER TABLE `settings` ADD `track_calories` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `calorie_goal` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `track_money` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `money_limit_cents` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `money_period` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `money_balance_cents` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `money_balance_on` text;--> statement-breakpoint
CREATE TRIGGER `sync_tracker_entries_insert` AFTER INSERT ON `tracker_entries` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('tracker_entries', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_tracker_entries_update` AFTER UPDATE ON `tracker_entries` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('tracker_entries', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_tracker_entries_delete` AFTER DELETE ON `tracker_entries` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('tracker_entries', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
