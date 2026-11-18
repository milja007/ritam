-- Korak 25: ciljevi razdoblja (tjedni / mjesečni / godišnji plan). Isto kao lokalna migracija 0012_goals.
-- Vlasnik-RLS, `synced_at` i tombstoni kao ostale sync tablice (20261111103947_sync).

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  period text not null check (period in ('week', 'month', 'year')),
  period_start date not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  position integer not null default 0 check (position between 0 and 999),
  done_on date,
  -- Početak razdoblja: tjedan ponedjeljkom, mjesec 1., godina 1. 1.
  constraint goals_period_start check (
    (period = 'week' and extract(isodow from period_start) = 1)
    or (period = 'month' and extract(day from period_start) = 1)
    or (period = 'year' and extract(day from period_start) = 1 and extract(month from period_start) = 1)
  )
);

comment on table public.goals is 'Ciljevi razdoblja (tjedan/mjesec/godina) — kontekst za plan dana.';

create index goals_user_period_idx on public.goals (user_id, period, period_start);

revoke all on public.goals from anon;

alter table public.goals enable row level security;

create policy goals_select_own on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete_own on public.goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Sync: vrijeme poslužitelja, kursor pulla, tombstone pri brisanju.
alter table public.goals add column synced_at timestamptz not null default now();
create index goals_user_synced_idx on public.goals (user_id, synced_at, id);
create trigger set_synced_at before insert or update on public.goals
  for each row execute function public.set_synced_at();
create trigger record_sync_tombstone after delete on public.goals
  for each row execute function public.record_sync_tombstone();

alter table public.sync_tombstones drop constraint sync_tombstones_table_name_check;
alter table public.sync_tombstones add constraint sync_tombstones_table_name_check check (table_name in (
  'settings', 'schedule_blocks', 'checkins', 'checkin_items',
  'rules', 'rule_logs', 'xp_events', 'reports', 'quests', 'goals'
));
