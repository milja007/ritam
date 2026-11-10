-- Ritam — početna Supabase shema (korak 17).
--
-- Stupci 1:1 s lokalnom SQLite shemom (`src/db/schema.ts`) i Zod domenom (`src/core/domain`):
--   id uuid · user_id uuid (vlasnik, auth.users) · created_at/updated_at timestamptz
--   datumi `date` ("YYYY-MM-DD") · sati `text` "HH:MM" · JSON → jsonb.
-- Vrijednosti iz domene su CHECK ograničenja (lakše proširiti od enum tipova).
-- `updated_at` postavlja klijent: sync (korak 19) uspoređuje zadnji updatedAt.
-- RLS: svaki korisnik vidi i mijenja samo svoje retke (uloga `authenticated`); `anon` nema pristup.

-- Pomoćne provjere ---------------------------------------------------------------------------

create function public.is_clock(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
$$;

comment on function public.is_clock(text) is 'Vrijeme u danu "HH:MM" (00:00–23:59).';

-- settings -----------------------------------------------------------------------------------

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  language text not null check (language in ('system', 'hr', 'en')),
  wake_time text not null check (public.is_clock(wake_time)),
  weekend_wake_time text check (public.is_clock(weekend_wake_time)),
  sleep_hours numeric(4, 2) not null
    check (sleep_hours between 4 and 12 and sleep_hours * 4 = trunc(sleep_hours * 4)),
  morning_notif_time text not null check (public.is_clock(morning_notif_time)),
  evening_notif_time text not null check (public.is_clock(evening_notif_time)),
  wind_down_minutes integer not null check (wind_down_minutes between 0 and 180),
  morning_notif_enabled boolean not null default true,
  evening_notif_enabled boolean not null default true,
  wind_down_notif_enabled boolean not null default true,
  theme text not null check (theme in ('system', 'dark', 'light')),
  google_calendar_connected boolean not null default false,
  constraint settings_user_id_unique unique (user_id)
);

comment on table public.settings is 'Korisničke postavke (jedan red po korisniku).';

-- schedule_blocks ----------------------------------------------------------------------------

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  title text not null check (char_length(title) between 1 and 200),
  start text not null check (public.is_clock(start)),
  "end" text not null check (public.is_clock("end")),
  -- Tablica `tasks` dolazi u fazi 2 (tjedni zadaci); tada se dodaje strani ključ.
  task_id uuid,
  kind text not null check (kind in ('task', 'fixed', 'calendar', 'sleep', 'unexpected')),
  source text not null check (source in ('user', 'llm', 'calendar')),
  status text not null check (status in ('planned', 'done', 'partial', 'skipped', 'moved')),
  -- San smije prijeći ponoć (23:00–07:00); ostali blokovi završavaju nakon početka.
  constraint schedule_blocks_end_after_start
    check (case when kind = 'sleep' then "end" <> start else "end" > start end)
);

comment on table public.schedule_blocks is 'Blokovi na timelineu dana; start/end su "HH:MM" na dan `date`.';

create index schedule_blocks_user_date_idx on public.schedule_blocks (user_id, date);

-- checkins -----------------------------------------------------------------------------------

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  kind text not null check (kind in ('morning', 'evening')),
  sleep_start text check (public.is_clock(sleep_start)),
  wake_time text check (public.is_clock(wake_time)),
  mood smallint check (mood between 1 and 5),
  day_rating smallint check (day_rating between 1 and 5),
  note text check (char_length(note) <= 2000),
  -- Jedan jutarnji i jedan večernji checkin po danu.
  constraint checkins_user_date_kind_unique unique (user_id, date, kind),
  -- Cilj složenih stranih ključeva iz checkin_items / rule_logs (isti vlasnik).
  constraint checkins_id_user_unique unique (id, user_id)
);

comment on table public.checkins is 'Jutarnja prijava i večernji upit.';

-- checkin_items ------------------------------------------------------------------------------

create table public.checkin_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checkin_id uuid not null,
  kind text not null check (kind in ('task', 'habit', 'rule', 'open-question')),
  -- Polimorfna referenca (blok, zabrana…); null za slobodno pitanje.
  ref_id uuid,
  ok boolean not null,
  outcome text not null default 'ok' check (outcome in ('ok', 'partial', 'not')),
  comment text check (char_length(comment) <= 2000),
  later_date date,
  moved_block_id uuid,
  constraint checkin_items_checkin_fk foreign key (checkin_id, user_id)
    references public.checkins (id, user_id) on delete cascade,
  constraint checkin_items_ok_matches_outcome check (ok = (outcome = 'ok')),
  constraint checkin_items_only_missed_moved check (outcome <> 'ok' or later_date is null)
);

create index checkin_items_checkin_idx on public.checkin_items (checkin_id);
create index checkin_items_user_idx on public.checkin_items (user_id);

-- rules (zabrane) ----------------------------------------------------------------------------

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 120),
  icon text check (char_length(icon) between 1 and 64),
  -- JSON niz dana u tjednu (0 = nedjelja … 6 = subota), npr. [1,2,3].
  active_days jsonb not null check (jsonb_typeof(active_days) = 'array'),
  -- JSON { "start": "HH:MM", "end": "HH:MM" } ili null = cijeli dan.
  active_hours jsonb check (
    active_hours is null
    or (
      jsonb_typeof(active_hours) = 'object'
      and public.is_clock(active_hours ->> 'start')
      and public.is_clock(active_hours ->> 'end')
    )
  ),
  why text not null check (char_length(why) <= 2000),
  weight smallint not null check (weight in (1, 2, 3)),
  constraint rules_id_user_unique unique (id, user_id)
);

comment on table public.rules is 'Zabrane (pravila koja korisnik poštuje).';

create index rules_user_idx on public.rules (user_id);

-- rule_logs ----------------------------------------------------------------------------------

create table public.rule_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rule_id uuid not null,
  date date not null,
  kept boolean not null,
  trigger text check (char_length(trigger) <= 2000),
  checkin_id uuid,
  constraint rule_logs_rule_fk foreign key (rule_id, user_id)
    references public.rules (id, user_id) on delete cascade,
  -- Brisanje checkina ostavlja zapis zabrane (samo checkin_id → null).
  constraint rule_logs_checkin_fk foreign key (checkin_id, user_id)
    references public.checkins (id, user_id) on delete set null (checkin_id),
  -- Jedan zapis po zabrani po danu.
  constraint rule_logs_rule_date_unique unique (rule_id, date)
);

create index rule_logs_user_date_idx on public.rule_logs (user_id, date);
create index rule_logs_checkin_idx on public.rule_logs (checkin_id);

-- xp_events ----------------------------------------------------------------------------------

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  source text not null check (source in ('task', 'rule', 'sleep', 'quest', 'checkin')),
  -- Polimorfna referenca (blok, zabrana, checkin…).
  source_id uuid,
  -- XP bez kazni: iznos je uvijek pozitivan.
  amount integer not null check (amount between 1 and 10000)
);

comment on table public.xp_events is 'Dodjele XP-a; ukupni XP, razina i streak se izvode.';

create index xp_events_user_date_idx on public.xp_events (user_id, date);

-- reports (dijagnoze) ------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  period text not null check (period in ('day', 'week', 'month', 'year')),
  period_start date not null,
  sections jsonb not null,
  stats jsonb not null,
  prompt_version text not null check (char_length(prompt_version) between 1 and 64),
  suggestion text check (char_length(suggestion) between 1 and 200),
  suggestion_accepted boolean,
  helpful boolean,
  feedback_comment text check (char_length(feedback_comment) <= 2000),
  -- Jedna dijagnoza po razdoblju.
  constraint reports_user_period_start_unique unique (user_id, period, period_start)
);

comment on table public.reports is 'Dijagnoze (dan, tjedan, mjesec, godina).';

-- llm_calls ----------------------------------------------------------------------------------
-- Piše samo Edge Function (service role); korisnik smije čitati svoje pozive.

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  function text not null check (char_length(function) between 1 and 64),
  provider text not null check (char_length(provider) between 1 and 32),
  model text not null check (char_length(model) between 1 and 128),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  ms integer check (ms >= 0),
  ok boolean not null
);

comment on table public.llm_calls is 'Dnevnik LLM poziva (funkcija, provider, model, tokeni, trajanje, uspjeh).';

create index llm_calls_user_created_idx on public.llm_calls (user_id, created_at);

-- Prava i RLS --------------------------------------------------------------------------------

revoke all on
  public.settings, public.schedule_blocks, public.checkins, public.checkin_items,
  public.rules, public.rule_logs, public.xp_events, public.reports, public.llm_calls
from anon;

revoke all on public.llm_calls from authenticated;
grant select on public.llm_calls to authenticated;

alter table public.settings enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_items enable row level security;
alter table public.rules enable row level security;
alter table public.rule_logs enable row level security;
alter table public.xp_events enable row level security;
alter table public.reports enable row level security;
alter table public.llm_calls enable row level security;

-- Vlasnik: select / insert / update / delete samo nad svojim retcima.
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'schedule_blocks', 'checkins', 'checkin_items',
    'rules', 'rule_logs', 'xp_events', 'reports'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
  end loop;
end
$$;

create policy llm_calls_select_own on public.llm_calls
  for select to authenticated using ((select auth.uid()) = user_id);
