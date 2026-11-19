-- Korak 31f: prihodi kao opcija trackera novca (zadano isključeno).
ALTER TABLE `settings` ADD `track_income` integer DEFAULT false NOT NULL;
