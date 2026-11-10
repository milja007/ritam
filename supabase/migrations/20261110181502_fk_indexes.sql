-- Indeksi koji pokrivaju složene strane ključeve (savjetnik Supabasea: unindexed_foreign_keys).
-- Samo dodavanje (bez DROP), da se može primijeniti bez ručne potvrde; stari jednostupčani
-- indeksi na checkin_id postaju suvišni i mogu se ukloniti kasnije.

create index checkin_items_checkin_user_idx on public.checkin_items (checkin_id, user_id);
create index rule_logs_checkin_user_idx on public.rule_logs (checkin_id, user_id);
create index rule_logs_rule_user_idx on public.rule_logs (rule_id, user_id);
