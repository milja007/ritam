-- Ručni dodatak (korak 12b): prije jedinstvenih indeksa ukloni duplikate — ostaje najnoviji zapis.
DELETE FROM `checkin_items` WHERE `checkin_id` IN (SELECT `c`.`id` FROM `checkins` `c` WHERE EXISTS (SELECT 1 FROM `checkins` `n` WHERE `n`.`user_id` = `c`.`user_id` AND `n`.`date` = `c`.`date` AND `n`.`kind` = `c`.`kind` AND (`n`.`updated_at` > `c`.`updated_at` OR (`n`.`updated_at` = `c`.`updated_at` AND `n`.`rowid` > `c`.`rowid`))));--> statement-breakpoint
UPDATE `rule_logs` SET `checkin_id` = NULL WHERE `checkin_id` IN (SELECT `c`.`id` FROM `checkins` `c` WHERE EXISTS (SELECT 1 FROM `checkins` `n` WHERE `n`.`user_id` = `c`.`user_id` AND `n`.`date` = `c`.`date` AND `n`.`kind` = `c`.`kind` AND (`n`.`updated_at` > `c`.`updated_at` OR (`n`.`updated_at` = `c`.`updated_at` AND `n`.`rowid` > `c`.`rowid`))));--> statement-breakpoint
DELETE FROM `xp_events` WHERE `source` = 'checkin' AND `source_id` IN (SELECT `c`.`id` FROM `checkins` `c` WHERE EXISTS (SELECT 1 FROM `checkins` `n` WHERE `n`.`user_id` = `c`.`user_id` AND `n`.`date` = `c`.`date` AND `n`.`kind` = `c`.`kind` AND (`n`.`updated_at` > `c`.`updated_at` OR (`n`.`updated_at` = `c`.`updated_at` AND `n`.`rowid` > `c`.`rowid`))));--> statement-breakpoint
DELETE FROM `checkins` WHERE EXISTS (SELECT 1 FROM `checkins` `n` WHERE `n`.`user_id` = `checkins`.`user_id` AND `n`.`date` = `checkins`.`date` AND `n`.`kind` = `checkins`.`kind` AND (`n`.`updated_at` > `checkins`.`updated_at` OR (`n`.`updated_at` = `checkins`.`updated_at` AND `n`.`rowid` > `checkins`.`rowid`)));--> statement-breakpoint
DELETE FROM `rule_logs` WHERE EXISTS (SELECT 1 FROM `rule_logs` `n` WHERE `n`.`rule_id` = `rule_logs`.`rule_id` AND `n`.`date` = `rule_logs`.`date` AND (`n`.`updated_at` > `rule_logs`.`updated_at` OR (`n`.`updated_at` = `rule_logs`.`updated_at` AND `n`.`rowid` > `rule_logs`.`rowid`)));--> statement-breakpoint
DROP INDEX `checkins_user_date_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_user_date_kind_unique` ON `checkins` (`user_id`,`date`,`kind`);--> statement-breakpoint
DROP INDEX `rule_logs_rule_date_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `rule_logs_rule_date_unique` ON `rule_logs` (`rule_id`,`date`);--> statement-breakpoint
ALTER TABLE `checkin_items` ADD `outcome` text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE `checkin_items` ADD `later_date` text;--> statement-breakpoint
ALTER TABLE `checkin_items` ADD `moved_block_id` text;--> statement-breakpoint
-- Ručni dodatak: postojeće stavke "Nije" (ok = 0) dobivaju outcome 'not'.
UPDATE `checkin_items` SET `outcome` = 'not' WHERE `ok` = 0;
