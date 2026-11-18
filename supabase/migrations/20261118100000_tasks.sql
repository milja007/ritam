-- Korak 25: tjedni zadaci s pitanjima (trajanje, rok, koliko puta, doba dana, što treba, energija).
-- Isto kao lokalna migracija 0013_tasks. Vlasnik-RLS, `synced_at` i tombstoni kao ostale sync tablice.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  week_start date not null check (extract(isodow from week_start) = 1),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  times_per_week integer not null check (times_per_week between 1 and 7),
  deadline date,
  part_of_day text not null check (part_of_day in ('any', 'morning', 'afternoon', 'evening')),
  energy text not null check (energy in ('low', 'medium', 'high')),
  needs text not null default '' check (char_length(needs) <= 300),
  -- Rok je dan unutar tog tjedna (pon–ned).
  constraint tasks_deadline_in_week check (
    deadline is null or (deadline >= week_start and deadline <= week_start + 6)
  )
);

comment on table public.tasks is 'Tjedni zadaci — odgovori na pitanja kod unosa; smještaju se kao blokovi (schedule_blocks.task_id).';

create index tasks_user_week_idx on public.tasks (user_id, week_start);

revoke all on public.tasks from anon;

alter table public.tasks enable row level security;

create policy tasks_select_own on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update_own on public.tasks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tasks_delete_own on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Sync: vrijeme poslužitelja, kursor pulla, tombstone pri brisanju.
alter table public.tasks add column synced_at timestamptz not null default now();
create index tasks_user_synced_idx on public.tasks (user_id, synced_at, id);
create trigger set_synced_at before insert or update on public.tasks
  for each row execute function public.set_synced_at();
create trigger record_sync_tombstone after delete on public.tasks
  for each row execute function public.record_sync_tombstone();

alter table public.sync_tombstones drop constraint sync_tombstones_table_name_check;
alter table public.sync_tombstones add constraint sync_tombstones_table_name_check check (table_name in (
  'settings', 'schedule_blocks', 'checkins', 'checkin_items',
  'rules', 'rule_logs', 'xp_events', 'reports', 'quests', 'goals', 'tasks'
));
