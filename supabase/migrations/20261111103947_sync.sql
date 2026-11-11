-- Korak 19: podrška za sync (red promjena lokalno → Supabase, pull pri pokretanju).
--
-- 1) `synced_at` postavlja POSLUŽITELJ pri svakom upisu. Pull čita retke s (`synced_at`, `id`)
--    većim od kursora, pa ne ovisi o satu uređaja: izmjena koja je satima bila offline (stari
--    `updated_at`) ipak stiže na druge uređaje. Konflikt i dalje rješava `updated_at` (klijent).
-- 2) `sync_tombstones`: okidač pri brisanju (i kaskadnom) zapisuje (tablica, id), da drugi
--    uređaji znaju što obrisati. Korisnik ih smije samo čitati (svoje); piše okidač.

create function public.set_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := now();
  return new;
end
$$;

comment on function public.set_synced_at() is 'Sync: vrijeme poslužitelja pri svakom upisu (kursor pulla).';

create table public.sync_tombstones (
  id bigint generated always as identity primary key,
  -- Bez stranog ključa: brisanje računa kaskadno briše retke, a okidač tada još piše tombstone.
  user_id uuid not null,
  table_name text not null check (table_name in (
    'settings', 'schedule_blocks', 'checkins', 'checkin_items',
    'rules', 'rule_logs', 'xp_events', 'reports'
  )),
  row_id uuid not null,
  deleted_at timestamptz not null default now()
);

comment on table public.sync_tombstones is 'Sync: obrisani retci (tablica, id) za pull na drugim uređajima.';

create index sync_tombstones_user_id_idx on public.sync_tombstones (user_id, id);

create function public.record_sync_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sync_tombstones (user_id, table_name, row_id)
  values (old.user_id, tg_table_name, old.id);
  return old;
end
$$;

comment on function public.record_sync_tombstone() is 'Sync: zapisuje tombstone pri brisanju retka (i kaskadnom).';

revoke all on function public.record_sync_tombstone() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'schedule_blocks', 'checkins', 'checkin_items',
    'rules', 'rule_logs', 'xp_events', 'reports'
  ] loop
    execute format('alter table public.%I add column synced_at timestamptz not null default now()', t);
    execute format('create index %I on public.%I (user_id, synced_at, id)', t || '_user_synced_idx', t);
    execute format(
      'create trigger set_synced_at before insert or update on public.%I for each row execute function public.set_synced_at()',
      t);
    execute format(
      'create trigger record_sync_tombstone after delete on public.%I for each row execute function public.record_sync_tombstone()',
      t);
  end loop;
end
$$;

revoke all on public.sync_tombstones from anon, authenticated;
grant select on public.sync_tombstones to authenticated;

alter table public.sync_tombstones enable row level security;

create policy sync_tombstones_select_own on public.sync_tombstones
  for select to authenticated using ((select auth.uid()) = user_id);
