-- Korak 16d: prekidač podsjetnika blokova (odluka P28) — zadano uključeni.
-- Isti stupac kao lokalna migracija 0005_block_reminders.

alter table public.settings add column block_reminders_enabled boolean not null default true;

comment on column public.settings.block_reminders_enabled is 'Podsjetnici na početku blokova (Gotovo / Odgodi / Iskrslo).';
