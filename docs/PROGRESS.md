# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-11 15:45 · Fix granica brzog puta (PR `fix/fast-path-granice`, puni review)
- Codexov naknadni review PR #5 (2× P1, 1× P2): visokorizičnom popisu dodani `CLAUDE.md`, `AGENTS.md`, `docs/AUTOMATION.md`, `docs/CONCEPT.md`, `docs/BUILD_PLAN.md`, `src/app/_layout.tsx`, `src/app/+native-intent.tsx`, `app.config.*`, `.env*`, `.gitignore`; brzi put je sada eksplicitna iznimka uz osnovno pravilo spajanja, a završna sekcija razdvaja handoff i `CLAUDE_MERGED_FAST`.
- Iznimka: samo `[ ]` → `[x]` u `BUILD_PLAN.md` ne čini PR visokorizičnim (inače nijedan korak ne bi mogao brzim putem).
- Codex nalazi za PR #6 (P1 preimenovanja, P2 konfiguracije provjera): klasifikacija s `git diff --no-renames --name-only -z`, preimenovanje računa obje putanje; `eslint.config.js`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `jest.config.*` i slične konfiguracije provjera su visokorizične; iznimka za `BUILD_PLAN.md` se provjerava sadržajem diffa (`-U0`).
- Codex nalazi za PR #6, 2. krug (P1, 2× P2, P3): nakon `CLAUDE_MERGED_FAST` sljedeća skupina se smije pripremati, ali predaja/merge čeka Codexov status za taj merge; `CODEX_APPROVED` s `MERGE` je potvrda već spojenog PR-a (bez ponovnog mergea); `.claude/**` je visokorizično; iznimka `[ ]` → `[x]` vrijedi samo za stvarne stavke koraka (`- [ ] **N.`), ne za legendu. Nakon odobrenja treba ažurirati i prompt scheduled taska prema `docs/AUTOMATION.md`.
- Codex nalazi za PR #6, 3. krug (P1, P2, P3): "otvoreni naknadni pregled" se provjerava kroz sve komentare #1 od zadnjeg `CLAUDE_MERGED_FAST` (ne samo zadnju poruku) i to **prije** grananja na handoff/merge; potisnuti `CLAUDE_MERGED_FAST` se nakon riješenog pitanja ponovno objavljuje (`REPOST`); `CLAUDE_MERGED_FAST` obavezno nosi `PR`, `BASE`, `HEAD`, `MERGE`; iznimka za `BUILD_PLAN.md` prihvaća i obične stavke (`- [ ] 24.`) i sparuje retke po poziciji u hunku (provjereno na simuliranom diffu 20/24/25).
- Codex nalazi za PR #6, 4. krug (3× P2): oporavak izgubljene objave (spojeni PR bez `CLAUDE_MERGED_FAST` u #1 → `RECOVERED` objava prije svega, provjera nedavno spojenih PR-ova); `REPOST` i kad handoff potisne običan komentar (uvjet je samo da nema otvorenog `BORNA_DECISION_NEEDED`); završni status nakon izvornika zatvara pregled i ako je `REPOST` objavljen poslije.

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
