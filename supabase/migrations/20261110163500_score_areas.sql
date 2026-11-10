-- Korak 16c: područja dnevnog rezultata (odluka P39) — plan / zabrane / san, barem jedno,
-- zadano samo plan. Isti stupci kao lokalna migracija 0004_score_areas.

alter table public.settings add column score_plan boolean not null default true;
alter table public.settings add column score_rules boolean not null default false;
alter table public.settings add column score_sleep boolean not null default false;
alter table public.settings
  add constraint settings_score_area_selected check (score_plan or score_rules or score_sleep);

comment on column public.settings.score_plan is 'Dnevni rezultat boduje plan dana.';
comment on column public.settings.score_rules is 'Dnevni rezultat boduje zabrane.';
comment on column public.settings.score_sleep is 'Dnevni rezultat boduje san.';
