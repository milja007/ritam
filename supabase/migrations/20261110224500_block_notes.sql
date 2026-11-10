-- Korak 17c: Komentar (= bilješka) na aktivnosti.
-- Isti stupac kao lokalna migracija 0007_block_notes.

alter table public.schedule_blocks add column note text check (note is null or char_length(note) <= 2000);

comment on column public.schedule_blocks.note is 'Komentar (= bilješka) na trenutnoj ili prošloj aktivnosti.';
