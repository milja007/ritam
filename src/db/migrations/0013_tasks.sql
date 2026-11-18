-- Korak 25: tjedni zadaci s pitanjima. Okidači reda za sync kao u 0009_sync.
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`week_start` text NOT NULL,
	`title` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`times_per_week` integer NOT NULL,
	`deadline` text,
	`part_of_day` text NOT NULL,
	`energy` text NOT NULL,
	`needs` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_user_week_idx` ON `tasks` (`user_id`,`week_start`);
--> statement-breakpoint
CREATE TRIGGER `sync_tasks_insert` AFTER INSERT ON `tasks` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('tasks', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_tasks_update` AFTER UPDATE ON `tasks` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('tasks', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_tasks_delete` AFTER DELETE ON `tasks` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('tasks', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
