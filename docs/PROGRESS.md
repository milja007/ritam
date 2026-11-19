# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-19 · Sesija 21:43 — korak 39 (dio): čista logika Health podataka
- #1: zadnja objava je #68 (Codex još nije pregledao). Nema P0/P1, bug issueja ni otvorenih PR-ova; pitanja 84, 92–94 bez odgovora. Svi neblokirani koraci gotovi.
- Plan (`wip/korak-39-health-logika`, kao 41: samo `src/core/health`, bez paketa i dopuštenja dok pitanje 94 nije odgovoreno): (1) `healthNight`: uzorci sna (u krevetu / spava / budan, s izvorom) → noć koja završava jutrom zadanog dana: segmenti spavanja spojeni uz prekid ≤ 60 min, najduži blok u prozoru 18:00 prethodnog dana – 14:00 tog dana; bez „spava“ uzoraka pada na „u krevetu“; rezultat `sleepStart`/`wakeTime` „HH:MM“ kao u jutarnjem upitu; (2) `dailyHealthTotal`: zbroj uzoraka količine (koraci, aktivne kcal) za lokalni dan, uzorak preko ponoći dijeli se razmjerno; (3) `healthSleepFill`: prijedlog za jutarnji upit samo kad korisnik sam nije upisao san (ručni unos uvijek pobjeđuje). Testovi uz svaki dio; ništa se još ne uvozi u app.
- Gotovo: (1)–(3) u PR-u #69 (15 testova, provjereno i s `TZ` Zagreb / Los Angeles / Auckland).

## 2026-11-19 · Sesija 18:43 — korak 22: odgovori na pitanja modela
- #1: Codex odobrio #66 i #67 bez novih nalaza. Nema P0/P1, bug issueja ni otvorenih PR-ova; pitanja 84, 92–94 bez odgovora. Svi neblokirani koraci su gotovi osim dorade 22 („odgovori na pitanja modela se još ne šalju natrag“).
- Plan (`wip/korak-22-odgovori`, HIGH_RISK zbog `supabase/functions`): (1) `PlanDayRequest.answers` (pitanje + odgovor, najviše 3, ≤ 300 znakova) u `edge-types` i `_shared/plan-logic` — stari klijent bez polja → `[]`, neispravan unos se tiho ispušta; (2) `plan-day` stavlja odgovore u poruku, a prompt kaže da ih poštuje i ne pita isto ponovo; (3) prijedlog: uz svako pitanje polje za odgovor (s diktiranjem), gumb „Odgovori i složi ponovo“ (aktivan uz barem jedan odgovor) šalje iste stavke + odgovore; (4) testovi (core, server parse/prompt linije, i18n). Treba ponovni deploy `plan-day` (Borna, uz pitanje 77).
- Gotovo: (1)–(4) u PR-u #68. Nakon ovoga svi preostali koraci (24, 34c, 39, 41) čekaju Bornu.

## 2026-11-19 · Sesija 15:43 — Codex P2 za vremensku crtu widgeta
- #1: Codex odobrio #65 i #66; jedan P2 za `widget.ts:152` (komentar 7010186119). Nema P0/P1, bug issueja ni otvorenih PR-ova; pitanja 84, 92–94 bez odgovora. Issue #1 se automatski zatvorio mergeom #65 ("Fixes #1" u PR-u) — ponovo otvoren.
- Plan: (1) `fix/widget-timeline-p2`: kad promjena ima više nego što stane (46), zastarjeli zapis („otvori Ritam“) dolazi na prvoj izostavljenoj promjeni umjesto u ponoć; test s 60 blokova (zadnji zapis 11:40, zastarjelost 11:45). Ostalo (24, 34c, 39, 41) čeka Bornu.

- Odluke Borne 2026-11-18 (pitanja 75–91) i sesije 09:43 i 12:43 su u arhivi.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. Ž11, 33, 32b i 31f gotovi — provjeriti na iPhoneu. 34c čeka pitanje 92.
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 24 (Google Calendar — OAuth tajne).
3. Svi koraci faza 1–3 osim 24 i 34c su gotovi. Faza 4 (39, 41) čeka pitanje 94; dotad samo čista logika (`src/core/widget`, `src/core/health`).

## Pitanja za Bornu
94. **Faza 4 (41 widget, 39 Health) i Apple račun:** iOS widget (`expo-widgets`) treba App Group, a besplatni Apple ID (osobni tim u Xcodeu) ga ne podržava — tvoj lokalni `expo run:ios --device` bi pao na potpisu. Opcije: (a) Apple Developer Program (99 USD/god.) → dodajem iOS widget (i Android); (b) za sada samo Android widget, iOS kasnije; (c) čeka. Za 39: koje podatke čitati iz Apple Health / Health Connect — san (vrijeme odlaska u krevet i buđenja → dio San), koraci, aktivne kalorije (tracker kalorija)? Samo čitanje? HealthKit s osobnim timom treba provjeriti na Macu. Dok nema odgovora radim samo čistu logiku widgeta (bez paketa).
93. **Glasovni unos i privatnost:** app traži prepoznavanje na uređaju, ali iOS za jezik bez modela na uređaju (možda hrvatski) šalje zvuk Appleu, kao diktiranje na tipkovnici. Ostaviti tako ili sakriti mikrofon kad prepoznavanje ne može ostati na uređaju? Dok nema odgovora, ostaje kako je.
92. **34c questovi „samo badge“:** ako maknem XP za etape i quest, postojeći XP iz questova nestaje i razina može pasti (koncept: bez kazni). Prijedlog: novi questovi bez XP-a, već dodijeljeni XP ostaje. U redu? Dok nema odgovora, questovi ostaju kako jesu.
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`, `income`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. ~~Deploy Edge Functions~~ — **deployano 2026-11-18 (Codex)**. Nakon PR-a s modelom i PR-a #68 (odgovori na pitanja) treba ponovo deployati (`npx supabase functions deploy plan-day`). Živi probni poziv čeka prijavljenog korisnika (migracije, pitanje 84).
- Pitanja 75–91 odgovorena 2026-11-18 (gore, „Odluke Borne“); 87 i 88 bez odgovora → ostaje kako je. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
