# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-11 12:30 · CI + kratki PROGRESS (PR `ci/github-actions`)
- Odluka (Borna proslijedio Codexovu preporuku): CI PR radi Claude, Codex ga samo pregledava. Korak 20 tek nakon `CODEX_APPROVED` za ovaj PR.
- `.github/workflows/ci.yml`: TypeScript, `expo lint`, Jest (`--runInBand`) i Supabase migracije + `tests/schema.sql` na svakom PR-u i pushu na `main`.
- Stari dnevnik (175 KB) premješten u `docs/PROGRESS-ARCHIVE.md`; ovaj ostaje kratak.

## Stanje
- `main`: koraci 0–19 gotovi + popravci retrospektivnog audita (PR #3: auth samo PKCE kod, sync vezan uz prvi račun, `seenAt` sinkroniziran, skripta radi na Bash 3.2).
- Remote Supabase `ritam`: svih 7 migracija primijenjeno (zadnja `20261111103947_sync`), advisori čisti, tablice prazne.
- Auth/sync su iza flaga `EXPO_PUBLIC_FEATURE_AUTH` (zadano isključeno).
- Na uređaju još neprovjereno: magic link / kod, sync s dva uređaja, Gotovo/Odgodi s ugašenim appom.

## Sljedeće
1. Codex review CI PR-a → merge.
2. Korak 20 — LLM provider (Edge Function `llm-provider`, Claude sada, sučelje za DeepSeek, logiranje u `llm_calls`; ključevi samo u Supabase secrets — API se naplaćuje zasebno od pretplate).

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
