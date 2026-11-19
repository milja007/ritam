# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-19 · Sesija 03:43 — korak 31f: prihodi (opcija trackera novca)
- Odluka Borna (pitanje 90, 2026-11-18): prihodi kao opcija, isključeni po defaultu, uključuju se u Profilu. Prioritet „Žar“ istekao 2026-11-17; 34c čeka pitanje 92.
- Plan: (1) Podaci (HIGH_RISK): vrsta unosa `income`, postavka `trackIncome` (zadano isključeno), lokalna migracija 0016 i Supabase migracija (stupac + `kind` check + gornja granica iznosa), testovi sheme/RLS i pariteta; remote primjenjuje Borna (pitanje 84). (2) Logika i UI: `moneySummary` broji prihode (danas/tjedan/mjesec) i dodaje ih stanju; limit potrošnje i dnevni rezultat se ne mijenjaju (prihod nije ponašanje). Profil → Novac → prekidač „Prati i prihode“ (vidljiv samo uz uključen novac); kartica na Danu: prihodi s popisom i unosom, HR/EN, a11y.
- Moje tumačenje: prihodi su dio trackera novca (bez novca nemaju smisla za stanje), ne ulaze u rezultat ni stat Novac.
- Gotovo (PR #62): 1–2, 31f `[x]`. Remote migracija `20261119030000_income` dodana u pitanje 84. Prihodi još nisu u dijagnozi ni kontekstu `write-report` (može kasnije ako Borna želi).

## 2026-11-19 · Sesija 00:43 (nastavak) — 32b nagrade po razini
- Plan: (1) `unlocks.ts` — vrste `frame` i `doneEffect`, razine 7/11/14 i 9/13 (popunjavaju praznine, prve nagrade ostaju iste), `usable*`, testovi; tekst otključanog za sve četiri vrste (HR/EN). (2) Okviri na `OrbFlame` (dišu s aureolom), `DoneFlare` (Iskre, Val) na točki trake Dana; uz „smanji kretanje“ samo bljesak. (3) Birač na Profilu s pregledom; odabir na uređaju, usklađen s razinom kao tema.
- 34c (questovi bez XP-a) namjerno nije rađen: oduzimanje XP-a može spustiti razinu (koncept: bez kazni) — treba Bornino „da“ za način (vidi pitanje 92).

## Odluke Borne (anketa u chatu, 2026-11-18 ~22:00)
- 89/91 (dijagnoze riječima): **u redu** — model piše tekst, promjenu/smjer bira app, samo svjež period.
- 90 (trackeri): u redu, **plus prihodi** — praćenje prihoda kao opcija, **isključeno po defaultu** (uključuje se u Profilu). → novi korak 31f.
- 85 (žeravica), 76 (rang), 75 (drugi račun ostaje blokiran), 78 (bedževi): **u redu, ostaje**.
- 86 (questovi): **„samo badge“** — tumačenje: ostvaren quest daje bedž, **bez XP-a** za etape i quest. → korak 34c.
- 80 (otključavanja): **dodati okvire avatara i animacije „Gotovo“** kao nagrade po razini. → korak 32b.
- Modeli (korak 40): **bez DeepSeeka**; „najjeftiniji, ali dobar za ovo“ → `parse-input` i `plan-day` Haiku 5.5, `write-report` Sonnet 5.5. `plan-day` treba ponovni deploy.
- 88 (zabrane) i 87 (wind-down po koraku): bez odgovora → ostaje kako je; wind-down i dalje prati ciljani krevet.

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-18 09:45): nema Codexovih zahtjeva od 2026-11-17 15:45; nema P0/P1 ni otvorenih P2.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. Ž11, 33, 32b i 31f gotovi — provjeriti na iPhoneu. 34c čeka pitanje 92; dalje koraci 20–22 (prioritet „Žar“ istekao).
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 30 (glasovni unos — novi paket), 24 (Google Calendar — OAuth tajne).
3. **Sljedeće skupine (Bornine odluke 2026-11-18):** 34c questovi samo s bedžem (bez XP-a); 31f prihodi kao opcijski tracker (isključen po defaultu; lokalna migracija + Supabase migracija = HIGH_RISK, remote primjenjuje Borna); 32b okviri avatara i animacije „Gotovo“ kao nagrade po razini. Uz to P2 nalazi Codexa kad stignu.

## Pitanja za Bornu
92. **34c questovi „samo badge“:** ako maknem XP za etape i quest, postojeći XP iz questova nestaje i razina može pasti (koncept: bez kazni). Prijedlog: novi questovi bez XP-a, već dodijeljeni XP ostaje. U redu? Dok nema odgovora, questovi ostaju kako jesu.
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`, `income`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. ~~Deploy Edge Functions~~ — **deployano 2026-11-18 (Codex)**. Nakon PR-a s modelom `plan-day` treba ponovo deployati (`npx supabase functions deploy plan-day`). Živi probni poziv čeka prijavljenog korisnika (migracije, pitanje 84).
- Pitanja 75–91 odgovorena 2026-11-18 (gore, „Odluke Borne“); 87 i 88 bez odgovora → ostaje kako je. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
