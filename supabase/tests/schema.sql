-- Provjere Supabase sheme (korak 17): RLS vlasnik, anon bez pristupa, CHECK-ovi, jedinstveni
-- indeksi i složeni strani ključevi. Pokreće `scripts/supabase-local-test.sh` nad svježom bazom.
-- Svaka provjera koja ne prođe baca iznimku (psql -v ON_ERROR_STOP=1 → izlazni kod ≠ 0).

\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
set client_min_messages = warning;

-- Dva korisnika ------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- Pomoćne funkcije testa (izvan public, brišu se na kraju) -----------------------------------
create schema test;
grant usage on schema test to anon, authenticated;

create function test.expect_error(statement text, expected_state text, label text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then
      return;
    end if;
    raise exception 'FAIL %: očekivan SQLSTATE %, dobiven % (%)', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL %: naredba je prošla, a nije smjela', label;
end
$$;

create function test.expect_count(query text, expected bigint, label text)
returns void
language plpgsql
as $$
declare
  actual bigint;
begin
  execute format('select count(*) from (%s) q', query) into actual;
  if actual <> expected then
    raise exception 'FAIL %: očekivano % redaka, dobiveno %', label, expected, actual;
  end if;
end
$$;

grant execute on all functions in schema test to anon, authenticated;

-- Korisnik A unosi podatke ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;

insert into public.settings (language, wake_time, weekend_wake_time, sleep_hours, morning_notif_time,
  evening_notif_time, wind_down_minutes, theme, google_calendar_connected)
values ('system', '07:00', '09:00', 7.75, '07:00', '21:30', 45, 'dark', false);

insert into public.schedule_blocks (id, date, title, start, "end", kind, source, status) values
  ('10000000-0000-0000-0000-000000000001', '2026-11-10', 'Trening', '18:00', '19:00', 'task', 'user', 'done'),
  ('10000000-0000-0000-0000-000000000002', '2026-11-10', 'San', '23:00', '07:00', 'sleep', 'user', 'planned');

insert into public.checkins (id, date, kind, day_rating, note) values
  ('20000000-0000-0000-0000-000000000001', '2026-11-10', 'evening', 4, 'Dobar dan');

insert into public.checkin_items (checkin_id, kind, ref_id, ok, outcome, comment, later_date) values
  ('20000000-0000-0000-0000-000000000001', 'task', '10000000-0000-0000-0000-000000000001', true, 'ok', null, null),
  ('20000000-0000-0000-0000-000000000001', 'task', null, false, 'partial', 'umoran', '2026-11-11');

insert into public.rules (id, title, active_days, active_hours, why, weight) values
  ('30000000-0000-0000-0000-000000000001', 'Bez mobitela u krevetu', '[0,1,2,3,4,5,6]',
   '{"start":"22:00","end":"07:00"}', 'Bolji san', 2);

insert into public.rule_logs (rule_id, date, kept, checkin_id) values
  ('30000000-0000-0000-0000-000000000001', '2026-11-10', true, '20000000-0000-0000-0000-000000000001');

insert into public.xp_events (date, source, source_id, amount) values
  ('2026-11-10', 'task', '10000000-0000-0000-0000-000000000001', 15),
  ('2026-11-10', 'checkin', '20000000-0000-0000-0000-000000000001', 10);

insert into public.reports (period, period_start, sections, stats, prompt_version, suggestion) values
  ('day', '2026-11-10', '{"summary":[]}', '{"plan":{"total":1}}', 'local-day-v2', 'idea.fewerBlocks');

-- user_id se popuni iz auth.uid()
select test.expect_count(
  $q$select 1 from public.schedule_blocks where user_id = '00000000-0000-0000-0000-00000000000a'$q$,
  2, 'zadani user_id = auth.uid()');

-- CHECK-ovi i jedinstvenost (23514 = check, 23505 = unique, 23503 = FK, 42501 = RLS/prava)
select test.expect_error($q$insert into public.schedule_blocks (date, title, start, "end", kind, source, status)
  values ('2026-11-10', 'X', '25:00', '26:00', 'task', 'user', 'planned')$q$, '23514', 'sat HH:MM');
select test.expect_error($q$insert into public.schedule_blocks (date, title, start, "end", kind, source, status)
  values ('2026-11-10', 'X', '10:00', '09:00', 'task', 'user', 'planned')$q$, '23514', 'kraj prije početka');
select test.expect_error($q$insert into public.schedule_blocks (date, title, start, "end", kind, source, status)
  values ('2026-11-10', 'X', '10:00', '11:00', 'task', 'user', 'unknown')$q$, '23514', 'nepoznat status');
select test.expect_error($q$insert into public.schedule_blocks (date, title, start, "end", kind, source, status)
  values ('2026-02-30', 'X', '10:00', '11:00', 'task', 'user', 'planned')$q$, '22008', 'nepostojeći datum');
select test.expect_error($q$insert into public.settings (language, wake_time, sleep_hours, morning_notif_time,
  evening_notif_time, wind_down_minutes, theme, google_calendar_connected)
  values ('hr', '07:00', 7.5, '07:00', '21:30', 45, 'dark', false)$q$, '23505', 'jedne postavke po korisniku');
select test.expect_error($q$update public.settings set sleep_hours = 7.1$q$, '23514', 'san u koracima od 15 min');
select test.expect_count($q$select 1 from public.settings where score_plan and not score_rules and not score_sleep$q$,
  1, 'zadano područje rezultata: samo plan');
select test.expect_error($q$update public.settings set score_plan = false$q$, '23514', 'plan je uvijek u rezultatu');
select test.expect_error($q$insert into public.checkins (date, kind, score_areas) values ('2026-11-01', 'evening', '["sleep"]')$q$,
  '23514', 'snimka područja mora imati plan');
select test.expect_error($q$insert into public.checkins (date, kind, score_areas) values ('2026-11-01', 'evening', '["plan", "mood"]')$q$,
  '23514', 'snimka samo s poznatim područjima');
select test.expect_error($q$insert into public.checkins (date, kind) values ('2026-11-10', 'evening')$q$,
  '23505', 'jedan večernji checkin po danu');
select test.expect_error($q$insert into public.checkins (date, kind, mood) values ('2026-11-09', 'morning', 6)$q$,
  '23514', 'raspoloženje 1–5');
select test.expect_error($q$insert into public.checkin_items (checkin_id, kind, ok, outcome)
  values ('20000000-0000-0000-0000-000000000001', 'task', true, 'not')$q$, '23514', 'ok mora odgovarati outcome');
select test.expect_error($q$insert into public.checkin_items (checkin_id, kind, ok, outcome, later_date)
  values ('20000000-0000-0000-0000-000000000001', 'task', true, 'ok', '2026-11-12')$q$, '23514', 'U redu se ne premješta');
select test.expect_error($q$insert into public.rule_logs (rule_id, date, kept)
  values ('30000000-0000-0000-0000-000000000001', '2026-11-10', false)$q$, '23505', 'jedan zapis zabrane po danu');
select test.expect_error($q$insert into public.rules (title, active_days, why, weight)
  values ('X', '[1]', '', 4)$q$, '23514', 'težina 1–3');
select test.expect_error($q$insert into public.rules (title, active_days, active_hours, why, weight)
  values ('X', '[1]', '{"start":"22"}', '', 1)$q$, '23514', 'activeHours {start,end}');
select test.expect_error($q$insert into public.xp_events (date, source, amount) values ('2026-11-10', 'task', -5)$q$,
  '23514', 'XP bez kazni');
select test.expect_error($q$insert into public.reports (period, period_start, sections, stats, prompt_version)
  values ('day', '2026-11-10', '{}', '{}', 'v')$q$, '23505', 'jedna dijagnoza po razdoblju');
select test.expect_error($q$insert into public.schedule_blocks (user_id, date, title, start, "end", kind, source, status)
  values ('00000000-0000-0000-0000-00000000000b', '2026-11-10', 'X', '10:00', '11:00', 'task', 'user', 'planned')$q$,
  '42501', 'ne može pisati u tuđe ime');
select test.expect_error($q$insert into public.llm_calls (user_id, function, provider, model, ok)
  values ('00000000-0000-0000-0000-00000000000a', 'plan-day', 'anthropic', 'm', true)$q$, '42501', 'llm_calls piše samo server');

reset role;

-- Korisnik B ne vidi ni ne mijenja A-ove podatke ---------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
set role authenticated;

select test.expect_count('select 1 from public.settings', 0, 'B ne vidi A-ove postavke');
select test.expect_count('select 1 from public.schedule_blocks', 0, 'B ne vidi A-ove blokove');
select test.expect_count('select 1 from public.checkins', 0, 'B ne vidi A-ove upite');
select test.expect_count('select 1 from public.checkin_items', 0, 'B ne vidi A-ove stavke');
select test.expect_count('select 1 from public.rules', 0, 'B ne vidi A-ove zabrane');
select test.expect_count('select 1 from public.rule_logs', 0, 'B ne vidi A-ove zapise zabrana');
select test.expect_count('select 1 from public.xp_events', 0, 'B ne vidi A-ov XP');
select test.expect_count('select 1 from public.reports', 0, 'B ne vidi A-ove dijagnoze');

update public.schedule_blocks set title = 'hack';
delete from public.xp_events;

-- Složeni FK: B ne može vezati svoj redak uz A-ov checkin ili zabranu.
select test.expect_error($q$insert into public.checkin_items (checkin_id, kind, ok, outcome)
  values ('20000000-0000-0000-0000-000000000001', 'task', true, 'ok')$q$, '23503', 'stavka na tuđi checkin');
select test.expect_error($q$insert into public.rule_logs (rule_id, date, kept)
  values ('30000000-0000-0000-0000-000000000001', '2026-11-11', true)$q$, '23503', 'zapis na tuđu zabranu');

-- B smije svoj checkin istog dana (jedinstvenost je po korisniku).
insert into public.checkins (date, kind) values ('2026-11-10', 'evening');
select test.expect_count('select 1 from public.checkins', 1, 'B ima svoj checkin');

reset role;

-- Anon nema pristup ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
select test.expect_error('select * from public.schedule_blocks', '42501', 'anon ne čita');
select test.expect_error($q$insert into public.checkins (date, kind) values ('2026-11-10', 'morning')$q$, '42501', 'anon ne piše');
reset role;

-- Server (service role) piše llm_calls; A čita samo svoje -----------------------------------
set role service_role;
insert into public.llm_calls (user_id, function, provider, model, input_tokens, output_tokens, ms, ok) values
  ('00000000-0000-0000-0000-00000000000a', 'plan-day', 'anthropic', 'claude-sonnet-5-5', 1200, 400, 2100, true),
  ('00000000-0000-0000-0000-00000000000b', 'parse-input', 'anthropic', 'claude-haiku-5-5', 100, 50, 300, true);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select test.expect_count('select 1 from public.llm_calls', 1, 'A vidi samo svoje LLM pozive');
select test.expect_count($q$select 1 from public.schedule_blocks where title = 'hack'$q$, 0, 'B nije promijenio A-ove blokove');
select test.expect_count('select 1 from public.xp_events', 2, 'B nije obrisao A-ov XP');

-- Brisanje checkina: stavke idu (cascade), zapis zabrane ostaje bez checkin_id.
delete from public.checkins where id = '20000000-0000-0000-0000-000000000001';
select test.expect_count('select 1 from public.checkin_items', 0, 'stavke obrisane s checkinom');
select test.expect_count('select 1 from public.rule_logs where checkin_id is null', 1, 'zapis zabrane ostaje');

-- Brisanje zabrane briše njene zapise.
delete from public.rules;
select test.expect_count('select 1 from public.rule_logs', 0, 'zapisi obrisani sa zabranom');

-- Sync (korak 19): brisanja (i kaskadna) ostavljaju tombstone koji vidi samo vlasnik.
select test.expect_count($q$select 1 from public.sync_tombstones where table_name = 'checkins'$q$, 1, 'tombstone checkina');
select test.expect_count($q$select 1 from public.sync_tombstones where table_name = 'checkin_items'$q$, 2, 'tombstoni kaskadno obrisanih stavki');
select test.expect_count($q$select 1 from public.sync_tombstones where table_name = 'rule_logs'$q$, 1, 'tombstone kaskadno obrisanog zapisa zabrane');
select test.expect_error($q$insert into public.sync_tombstones (user_id, table_name, row_id)
  values ((select auth.uid()), 'rules', gen_random_uuid())$q$, '42501', 'klijent ne piše tombstone');
-- synced_at postavlja poslužitelj, i kad ga klijent pokuša zadati.
update public.xp_events set synced_at = '2000-01-01', amount = amount;
select test.expect_count($q$select 1 from public.xp_events where synced_at < now() - interval '1 minute'$q$, 0, 'synced_at od poslužitelja');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
select test.expect_count('select 1 from public.sync_tombstones', 0, 'B ne vidi A-ove tombstone');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
reset role;

-- Svaka tablica u public ima RLS --------------------------------------------------------------
select test.expect_count(
  $q$select 1 from pg_tables where schemaname = 'public' and not rowsecurity$q$, 0, 'RLS na svim tablicama');

-- Brisanje korisnika briše njegove podatke.
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select test.expect_count(
  $q$select 1 from public.settings union all select 1 from public.schedule_blocks
     union all select 1 from public.xp_events union all select 1 from public.reports
     union all select 1 from public.llm_calls where user_id = '00000000-0000-0000-0000-00000000000a'$q$,
  0, 'brisanje korisnika briše podatke');

drop schema test cascade;

\echo 'supabase/tests/schema.sql: sve provjere prošle'
