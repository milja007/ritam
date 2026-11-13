# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-13 · Smjer „Žar“ (grana `wip/zar-dan-tjedan`)
- **Odluka Borna 2026-11-12:** vizualni smjer „Žar“ („dan izgori u žar“) ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu (Dan, Tjedan, Mjesec, Godina, Profil). **Odluka Borna 2026-11-13 (chat):** smije ići paralelno dok PR #6 čeka review.
- Ideja: orb-plamen putuje niz današnji raspored; odrađeno iza njega svijetli, plan ispred je tek ocrtan; svaki dan je žar čija svjetlina znači dnevni rezultat (tjedan: 7 stupaca, mjesec: kalendar žarova, godina: 365 točkica); neodrađeno je ugašen žar, nikad crveni X.
- Plan skupine (redom, svaki korak zaseban commit `Žar N: …`):
  1. Ž1 jezgra `src/core/ember` (svjetlina iz rezultata 55/70/85, stanje točke na traci, boje za tamnu i svijetlu shemu) + tokeni `ember*`, testovi. **Gotovo.**
  2. Ž2 Dan: kronološka traka (ranije → plamen „Sada“ → ostatak dana), izgorjela puna linija iza, crtkana ispred, orb s pulsom (Reanimated, poštuje „smanji kretanje“), bez crvene za neodrađeno.
  3. Ž3 Tjedan: 7 stupaca dana s blokovima, linija „sada“, žar i rezultat ispod svakog dana (lokalni podaci).
  4. Ž4 Mjesec: kalendar žarova + usporedba s prošlim mjesecom. Ž5 Godina: 365 točkica + rekordi.
  5. Ž6 Profil i faza 3 (33 orb, 35 animacije i haptika, 34b rang i statovi, 37c grafovi, 38 teme) — sljedeće skupine.
- Provjera plana: bez novih paketa (samo `View`, `boxShadow`, Reanimated koji već postoji), pa PR ne dira visokorizične datoteke. Ciljevi tjedna/mjeseca/godine i „[Sustav]“ poruke s platna još nemaju podatke (koraci 25, 25b, 34b) — ne izmišljam ih, sekcije dolaze s tim koracima. Redoslijed u `BUILD_PLAN.md` (visokorizično) ide zasebnim docs PR-om kad PR #6 prođe.

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
