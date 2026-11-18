-- Korak 31b: opcionalni trackeri kalorija i novca (isključeni po defaultu).
-- Isto kao lokalna migracija 0015_trackers. Vlasnik-RLS, `synced_at` i tombstoni kao ostale sync tablice.

alter table public.settings add column track_calories boolean not null default false;
alter table public.settings add column calorie_goal integer
  check (calorie_goal is null or calorie_goal between 500 and 10000);
alter table public.settings add column track_money boolean not null default false;
alter table public.settings add column money_limit_cents integer
  check (money_limit_cents is null or money_limit_cents between 1 and 100000000);
alter table public.settings add column money_period text
  check (money_period is null or money_period in ('day', 'week', 'month'));
alter table public.settings add column money_balance_cents integer
  check (money_balance_cents is null or money_balance_cents between -100000000 and 100000000);
alter table public.settings add column money_balance_on date;

comment on column public.settings.calorie_goal is 'Dnevni cilj kalorija (kcal); null = nije postavljen.';
comment on column public.settings.money_limit_cents is 'Limit potrošnje u centima za money_period.';
comment on column public.settings.money_balance_cents is 'Stanje na dan money_balance_on; potrošnja od tog dana se oduzima.';

create table public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  kind text not null check (kind in ('calories', 'money')),
  amount integer not null check (amount >= 1),
  note text not null default '' check (char_length(note) <= 200),
  -- Kalorije: najviše 10 000 kcal po unosu; novac: najviše 1 000 000 € (u centima).
  constraint tracker_entries_amount_max check (
    (kind = 'calories' and amount <= 10000) or (kind = 'money' and amount <= 100000000)
  )
);

comment on table public.tracker_entries is 'Unosi trackera (korak 31b): obroci/kcal ili potrošnja s bilješkom.';

create index tracker_entries_user_date_idx on public.tracker_entries (user_id, date);

revoke all on public.tracker_entries from anon;

alter table public.tracker_entries enable row level security;

create policy tracker_entries_select_own on public.tracker_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tracker_entries_insert_own on public.tracker_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tracker_entries_update_own on public.tracker_entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tracker_entries_delete_own on public.tracker_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Sync: vrijeme poslužitelja, kursor pulla, tombstone pri brisanju.
alter table public.tracker_entries add column synced_at timestamptz not null default now();
create index tracker_entries_user_synced_idx on public.tracker_entries (user_id, synced_at, id);
create trigger set_synced_at before insert or update on public.tracker_entries
  for each row execute function public.set_synced_at();
create trigger record_sync_tombstone after delete on public.tracker_entries
  for each row execute function public.record_sync_tombstone();

alter table public.sync_tombstones drop constraint sync_tombstones_table_name_check;
alter table public.sync_tombstones add constraint sync_tombstones_table_name_check check (table_name in (
  'settings', 'schedule_blocks', 'checkins', 'checkin_items',
  'rules', 'rule_logs', 'xp_events', 'reports', 'quests', 'goals', 'tasks', 'tracker_entries'
));
