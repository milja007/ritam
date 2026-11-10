-- Korak 16c: područja dnevnog rezultata (odluka P39, dorađena 2026-11-10) — plan uvijek, zabrane i
-- san opcionalni (zadano isključeni). Isti stupci kao lokalne migracije 0004 i 0005.

alter table public.settings add column score_plan boolean not null default true;
alter table public.settings add column score_rules boolean not null default false;
alter table public.settings add column score_sleep boolean not null default false;
alter table public.settings add constraint settings_score_plan_always check (score_plan);

comment on column public.settings.score_plan is 'Dnevni rezultat uvijek boduje plan dana.';
comment on column public.settings.score_rules is 'Dnevni rezultat boduje zabrane.';
comment on column public.settings.score_sleep is 'Dnevni rezultat boduje san.';

-- Snimka područja pri zaključivanju dana (P48: prošli dani zadrže staro bodovanje).
alter table public.checkins add column score_areas jsonb;
alter table public.checkins add constraint checkins_score_areas_valid check (
  score_areas is null
  or (
    jsonb_typeof(score_areas) = 'array'
    and score_areas ? 'plan'
    and score_areas <@ '["plan", "rules", "sleep"]'::jsonb
  )
);

comment on column public.checkins.score_areas is 'Područja rezultata koja su vrijedila za taj dan (večernji upit).';
