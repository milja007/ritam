-- Korak 34: epski questovi (Profil). Okidači reda za sync kao u 0009_sync.
CREATE TABLE `quests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`title` text NOT NULL,
	`why` text NOT NULL,
	`target_date` text,
	`milestones` text NOT NULL,
	`status` text NOT NULL,
	`done_on` text
);
--> statement-breakpoint
CREATE INDEX `quests_user_idx` ON `quests` (`user_id`);
--> statement-breakpoint
CREATE TRIGGER `sync_quests_insert` AFTER INSERT ON `quests` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('quests', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_quests_update` AFTER UPDATE ON `quests` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('quests', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_quests_delete` AFTER DELETE ON `quests` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('quests', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
