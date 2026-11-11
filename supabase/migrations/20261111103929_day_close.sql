-- Korak 17d: "Odustajem od svega" i pokupljena dijagnoza dana.
-- Isti stupci kao lokalna migracija 0008_day_close.

alter table public.checkins add column gave_up boolean not null default false;
alter table public.checkins add column gave_up_note text check (gave_up_note is null or char_length(gave_up_note) <= 2000);
alter table public.reports add column seen_at timestamptz;

comment on column public.checkins.gave_up is 'Večernji checkin: Odustajem od svega — preostali blokovi zatvoreni kao neodrađeni; ne ruši streak.';
comment on column public.checkins.gave_up_note is 'Što se dogodilo (kontekst za dijagnozu i planiranje).';
comment on column public.reports.seen_at is 'Kad je dijagnoza pokupljena na tabu Dan; null = još nije viđena.';
