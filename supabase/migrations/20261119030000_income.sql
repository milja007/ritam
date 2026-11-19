-- Korak 31f: prihodi kao opcija trackera novca (odluka Borna uz pitanje 90; zadano isključeno).
-- Isto kao lokalna migracija 0016_income. Prihod je unos `tracker_entries` vrste 'income'
-- (iznos u centima, iste granice kao potrošnja); RLS, sync i tombstoni već pokrivaju tablicu.

alter table public.settings add column track_income boolean not null default false;

alter table public.tracker_entries drop constraint tracker_entries_kind_check;
alter table public.tracker_entries add constraint tracker_entries_kind_check
  check (kind in ('calories', 'money', 'income'));

alter table public.tracker_entries drop constraint tracker_entries_amount_max;
alter table public.tracker_entries add constraint tracker_entries_amount_max check (
  (kind = 'calories' and amount <= 10000) or (kind in ('money', 'income') and amount <= 100000000)
);

comment on column public.settings.track_income is 'Prati i prihode (korak 31f); prihod se dodaje stanju, ne mijenja limit ni rezultat.';
