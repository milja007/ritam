# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-18 · Sesija 21:43 — korak 31e: godišnja dijagnoza riječima
- Plan (isti obrazac kao 31c/31d; koncept: godišnja = dan + tjedan + mjesec + godina, smjer najviše 2 ideje):
  (1) `write-report` godišnji način (`llm-year-v1`): statistika godine i prošle (s trackerima), prosjek po mjesecima (12), sažeci mjesečnih dijagnoza te godine (bez 365 dana — previše), lokalni smjer, tjedne promjene godine, do 2 ranije godišnje s Pomoglo/Nije. Granice brojeva skaliraju s duljinom razdoblja (godina ima > 5000 blokova). Model piše riječi + jednu rečenicu uz smjer; smjer ne mijenja.
  (2) App: `sections.llm` uz godišnju (otpada kad se statistika ili smjer promijene), poziv samo za svježu godinu (31. 12. ili 1. 1.), bez oblaka lokalna; kartica Godine koristi `llm.summary`.
- Pitanje 91 vrijedi i za godinu.

## 2026-11-18 · Sesija 18:43 (nastavak) — korak 31d: mjesečna dijagnoza riječima
- Plan (isti obrazac kao 31c; koncept: mjesečna = dan + tjedan + mjesec, najviše 2 ideje kao smjer):
  (1) `write-report` mjesečni način (`llm-month-v1`): statistika mjeseca i prošlog (s trackerima), dani mjeseca ukratko (uzorci po danu u tjednu i polovicama), lokalne ideje-smjer, odgovori na tjedne promjene, ranije mjesečne dijagnoze s Pomoglo/Nije. Model piše riječi + jednu rečenicu uz smjer; ideje ne mijenja.
  (2) App: `sections.llm` uz mjesečnu dijagnozu (otpada kad se statistika ili ideje promijene), poziv samo za svjež mjesec (zadnji dan ili dan poslije), bez oblaka lokalna.
- Gotovo (PR #53): 1–2. Korak 31d `[~]` do deploya (pitanje 77). Pitanje 91 vrijedi i za mjesec (model ne mijenja smjer, samo svjež mjesec).

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-18 09:45): nema Codexovih zahtjeva od 2026-11-17 15:45; nema P0/P1 ni otvorenih P2.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. **Ž11 haptika / Skia (33)** — čeka Bornu: `npx expo install expo-haptics` (i Skia) na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API).
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 30 (glasovni unos — novi paket), 24 (Google Calendar — OAuth tajne), 29 (wind-down po koraku — pitanje 87).
3. Bez Borne sljedeće sesije mogu: godišnja dijagnoza riječima (isti obrazac kao 31c/31d, `llm-year-v1`), P2 nalaze Codexa kad stignu, sažetak starih pitanja (23–70) u jedan paket.

## Pitanja za Bornu
91. **Tjedna dijagnoza s trackerima i LLM-om (31c)** — nije u konceptu, odabrano: o trackeru u tjednu se govori tek s barem 2 dana unosa; pohvala kalorija kad je ≥ 70 % dana s unosom unutar cilja; potrošnja se uspoređuje sa zbrojem dnevnih dijelova limita za dane s unosom. Model piše riječi i jednu rečenicu „zašto ova promjena“, a **promjenu tjedna i dalje bira lokalna logika** (da „najviše jedna promjena tjedno“ i pauza za odbijene ostanu pouzdani). Model piše samo za tjedan koji je upravo završio (nedjelja/ponedjeljak). U redu?
90. **Trackeri (31b)** — nije u konceptu, odabrano: kalorije „unutar cilja“ = ±10 %; upozorenje kad je cilj < 1200 kcal (cilj 500–10 000 je dopušten); novac u € (centi u bazi), limit za dan/tjedan/mjesec (tjedan pon–ned), stanje = zadani iznos na dan X minus potrošnja od tog dana; potrošnja s budućim datumom se ne broji. U rezultatu: težina 15 svaki, samo dani s unosima (dan bez potrošnje koji nije zapisan ne ulazi), isključen tracker ne ulazi ni u prošle dane (za razliku od područja, nema snimke). Treba li druga valuta ili prihodi (ne samo potrošnja)?
89. **LLM dijagnoza dana (31)** — nije u konceptu, odabrano: model piše riječi (Ukratko, do 3 pohvale, do 3 uočena uzorka, do 2 velika problema, 1–2 ideje; redak ≤ 280 znakova), brojke „Napretka“ i trend ostaju lokalni; kontekst = danas, jučer, do 14 ranijih dana (komentari, prekršaji), zadnjih 5 dijagnoza s Pomoglo/Nije i komentarom; piše se samo za danas i jučer. U redu?
84. **Remote migracije `color_theme` (odluka 81), `quests` (korak 34), `goals` i `tasks` (korak 25), `rule_periods` (korak 28), `trackers` (korak 31b)** — Claudeov alat ne smije primijeniti. Na Macu: `npx supabase db push` (primijeni `20261117010000_color_theme.sql`, `20261117180000_quests.sql`, `20261118060000_goals.sql`, `20261118100000_tasks.sql` i `20261118120000_rule_periods.sql`, `20261118160000_trackers.sql`). Dok nisu primijenjene, sync ne smije biti uključen.
77. Deploy Edge Functions (20–22, 26, 31): ključ je već u secrets (2026-11-09), model je tvoja odluka od 2026-11-09 i sada je u kodu (`parse-input` Haiku 5.5, `plan-day` i `write-report` Sonnet 5.5). Ostaje samo na Macu: `npx supabase functions deploy parse-input`, `plan-day` i `write-report` — kad uključiš oblak. Primjeri za probu `write-report`: `supabase/functions/_shared/report-examples.ts`.
- Otvorena pitanja 75, 76, 78, 80, 85–88 premještena su u arhivu (2026-11-18 18:43) pod „Otvorena pitanja (premještena)“ — i dalje čekaju odgovor. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
