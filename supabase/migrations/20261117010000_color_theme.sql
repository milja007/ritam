-- Odluka 81 (Borna, 2026-11-15): tema boja plamena se sinkronizira s računom.
-- Isti stupac kao lokalna migracija 0010_color_theme. Običan tekst (bez popisa tema), da novija
-- tema s drugog uređaja ne ruši sync; app nepoznatu temu čita kao zadanu.

alter table public.settings add column color_theme text
  check (color_theme is null or char_length(color_theme) between 1 and 32);

comment on column public.settings.color_theme is 'Tema boja plamena (korak 38); null = nije birana na računu.';
