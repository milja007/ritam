# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-11 15:45 · Fix granica brzog puta (PR `fix/fast-path-granice`, puni review)
- Codexov naknadni review PR #5 (2× P1, 1× P2): visokorizičnom popisu dodani `CLAUDE.md`, `AGENTS.md`, `docs/AUTOMATION.md`, `docs/CONCEPT.md`, `docs/BUILD_PLAN.md`, `src/app/_layout.tsx`, `src/app/+native-intent.tsx`, `app.config.*`, `.env*`, `.gitignore`; brzi put je sada eksplicitna iznimka uz osnovno pravilo spajanja, a završna sekcija razdvaja handoff i `CLAUDE_MERGED_FAST`.
- Iznimka: samo `[ ]` → `[x]` u `BUILD_PLAN.md` ne čini PR visokorizičnim (inače nijedan korak ne bi mogao brzim putem).
- Codex nalazi za PR #6 (P1 preimenovanja, P2 konfiguracije provjera): klasifikacija s `git diff --no-renames --name-only -z`, preimenovanje računa obje putanje; `eslint.config.js`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `jest.config.*` i slične konfiguracije provjera su visokorizične; iznimka za `BUILD_PLAN.md` se provjerava sadržajem diffa (`-U0`).

## 2026-11-11 12:30 · CI + kratki PROGRESS (PR `ci/github-actions`)
- Odluka (Borna proslijedio Codexovu preporuku): CI PR radi Claude, Codex ga samo pregledava. Korak 20 tek nakon `CODEX_APPROVED` za ovaj PR.
- `.github/workflows/ci.yml`: TypeScript, `expo lint`, Jest (`--runInBand`) i Supabase migracije + `tests/schema.sql` na svakom PR-u i pushu na `main`.
- Stari dnevnik (175 KB) premješten u `docs/PROGRESS-ARCHIVE.md`; ovaj ostaje kratak.
- Automatske sesije: s 10 na **2× dnevno** (06:43, 18:43), prvo samo zadnja 2 komentara u #1 (Borna, 2026-11-11). `docs/AUTOMATION.md` ažuriran.

## 2026-11-11 13:00 · Brži rad (Borna: "presporo")
- 7 sesija dnevno (00:43, 06:43, 09:43, 12:43, 15:43, 18:43, 21:43; Borna: "treba jače raditi"); 2–4 povezana koraka po PR-u; brzi put: PR bez visokorizičnih datoteka Claude spaja na zelenom CI-ju, Codex pregledava naknadno (`CLAUDE_MERGED_FAST`). Pravila u `CLAUDE.md` → "Brži rad".
- Sljedeća skupina: koraci 20–22 (LLM provider, parse-input, plan-day) — sve visokorizično (Edge Functions, LLM ključevi) → puni review.

## Stanje
- `main`: koraci 0–19 gotovi + popravci retrospektivnog audita (PR #3: auth samo PKCE kod, sync vezan uz prvi račun, `seenAt` sinkroniziran, skripta radi na Bash 3.2).
- Remote Supabase `ritam`: svih 7 migracija primijenjeno (zadnja `20261111103947_sync`), advisori čisti, tablice prazne.
- Auth/sync su iza flaga `EXPO_PUBLIC_FEATURE_AUTH` (zadano isključeno).
- Na uređaju još neprovjereno: magic link / kod, sync s dva uređaja, Gotovo/Odgodi s ugašenim appom.

## Sljedeće
1. Skupina 20–22 na jednom PR-u (puni review), zatim 23.
2. Korak 20 — LLM provider (Edge Function `llm-provider`, Claude sada, sučelje za DeepSeek, logiranje u `llm_calls`; ključevi samo u Supabase secrets — API se naplaćuje zasebno od pretplate).

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
