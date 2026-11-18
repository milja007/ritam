-- Korak 28: zabrana pripada tjednom / mjesečnom / godišnjem planu; NULL = stalna (postojeće zabrane).
ALTER TABLE `rules` ADD `period` text;--> statement-breakpoint
ALTER TABLE `rules` ADD `period_start` text;