-- Korak 19: red promjena za sync sa Supabaseom (ručna migracija).
-- Jedan unos po (tablica, id) s posljednjom operacijom; `version` raste pri svakoj promjeni,
-- pa push uklanja samo unose koji se nisu mijenjali dok je slao. Okidači šute dok sync
-- primjenjuje retke s poslužitelja (`sync_state.applying_remote`).
CREATE TABLE `sync_queue` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`op` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`table_name`, `row_id`)
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TRIGGER `sync_settings_insert` AFTER INSERT ON `settings` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('settings', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_update` AFTER UPDATE ON `settings` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('settings', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_settings_delete` AFTER DELETE ON `settings` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('settings', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_rules_insert` AFTER INSERT ON `rules` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('rules', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_rules_update` AFTER UPDATE ON `rules` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('rules', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_rules_delete` AFTER DELETE ON `rules` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('rules', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_checkins_insert` AFTER INSERT ON `checkins` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('checkins', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_checkins_update` AFTER UPDATE ON `checkins` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('checkins', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_checkins_delete` AFTER DELETE ON `checkins` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('checkins', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_schedule_blocks_insert` AFTER INSERT ON `schedule_blocks` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('schedule_blocks', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_schedule_blocks_update` AFTER UPDATE ON `schedule_blocks` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('schedule_blocks', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_schedule_blocks_delete` AFTER DELETE ON `schedule_blocks` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('schedule_blocks', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_checkin_items_insert` AFTER INSERT ON `checkin_items` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('checkin_items', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_checkin_items_update` AFTER UPDATE ON `checkin_items` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('checkin_items', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_checkin_items_delete` AFTER DELETE ON `checkin_items` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('checkin_items', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_rule_logs_insert` AFTER INSERT ON `rule_logs` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('rule_logs', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_rule_logs_update` AFTER UPDATE ON `rule_logs` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('rule_logs', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_rule_logs_delete` AFTER DELETE ON `rule_logs` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('rule_logs', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_xp_events_insert` AFTER INSERT ON `xp_events` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('xp_events', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_xp_events_update` AFTER UPDATE ON `xp_events` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('xp_events', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_xp_events_delete` AFTER DELETE ON `xp_events` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('xp_events', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_reports_insert` AFTER INSERT ON `reports` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('reports', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_reports_update` AFTER UPDATE ON `reports` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('reports', NEW.`id`, 'upsert')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_reports_delete` AFTER DELETE ON `reports` WHEN NOT EXISTS (SELECT 1 FROM `sync_state` WHERE `key` = 'applying_remote')
BEGIN
	INSERT INTO `sync_queue` (`table_name`, `row_id`, `op`) VALUES ('reports', OLD.`id`, 'delete')
	ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `version` = `version` + 1;
END;
