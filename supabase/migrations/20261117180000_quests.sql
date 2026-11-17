-- Korak 34: epski questovi (Profil). Isto kao lokalna migracija 0011_quests.
-- Etape su jsonb niz `{ id, title, doneOn }` u retku questa (sync kao cjelina, zadnji `updated_at`
-- pobjeđuje). Vlasnik-RLS, `synced_at` i tombstoni kao ostale sync tablice (20261111103947_sync).

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 120),
  why text not null default '' check (char_length(why) <= 2000),
  target_date date,
  milestones jsonb not null default '[]'::jsonb check (
    jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 12
  ),
  status text not null check (status in ('active', 'done', 'archived')),
  done_on date,
  -- Ostvaren ima dan, u tijeku ga nema; arhiva čuva dan ako je quest bio ostvaren.
  constraint quests_done_on_status check (
    (status = 'done' and done_on is not null)
    or (status = 'active' and done_on is null)
    or status = 'archived'
  )
);

comment on table public.quests is 'Epski questovi (dugoročni ciljevi u Profilu); etape u jsonb.';

create index quests_user_idx on public.quests (user_id);

revoke all on public.quests from anon;

alter table public.quests enable row level security;

create policy quests_select_own on public.quests
  for select to authenticated using ((select auth.uid()) = user_id);
create policy quests_insert_own on public.quests
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy quests_update_own on public.quests
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy quests_delete_own on public.quests
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Sync: vrijeme poslužitelja, kursor pulla, tombstone pri brisanju.
alter table public.quests add column synced_at timestamptz not null default now();
create index quests_user_synced_idx on public.quests (user_id, synced_at, id);
create trigger set_synced_at before insert or update on public.quests
  for each row execute function public.set_synced_at();
create trigger record_sync_tombstone after delete on public.quests
  for each row execute function public.record_sync_tombstone();

alter table public.sync_tombstones drop constraint sync_tombstones_table_name_check;
alter table public.sync_tombstones add constraint sync_tombstones_table_name_check check (table_name in (
  'settings', 'schedule_blocks', 'checkins', 'checkin_items',
  'rules', 'rule_logs', 'xp_events', 'reports', 'quests'
));
