-- Korak 25: ciljevi razdoblja (tjedan/mjesec/godina). Okidači reda za sync kao u 0009_sync.
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`period` text NOT NULL,
	`period_start` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`done_on` text
);
--> statement-breakpoint
CREATE INDEX `goals_user_period_idx` ON `goals` (`user_id`,`period`,`period_start`);
--> statement-breakpoint
CREATE TRIGGER `sync_goals_insert` AFTER INSERT ON `goals` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('goals', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_goals_update` AFTER UPDATE ON `goals` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('goals', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_goals_delete` AFTER DELETE ON `goals` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('goals', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
