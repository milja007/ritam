-- Korak 28: zabrana pripada tjednom / mjesečnom / godišnjem planu. Isto kao lokalna migracija
-- 0014_rule_periods. Oba stupca null = stalna zabrana (postojeće zabrane iz onboardinga).

alter table public.rules add column period text check (period in ('week', 'month', 'year'));
alter table public.rules add column period_start date;

-- Početak razdoblja: tjedan ponedjeljkom, mjesec 1., godina 1. 1.; oba null ili oba zadana.
-- `coalesce`: null u usporedbi bi inače propustio provjeru (CHECK prolazi na null).
alter table public.rules add constraint rules_period_start check (
  coalesce(
    (period is null and period_start is null)
    or (period = 'week' and period_start is not null and extract(isodow from period_start) = 1)
    or (period = 'month' and period_start is not null and extract(day from period_start) = 1)
    or (
      period = 'year' and period_start is not null
      and extract(day from period_start) = 1 and extract(month from period_start) = 1
    ),
    false
  )
);

comment on column public.rules.period is 'Razdoblje plana (korak 28); null = stalna zabrana.';
comment on column public.rules.period_start is 'Prvi dan razdoblja; null točno kad je period null.';
