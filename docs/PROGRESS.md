# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-20 · Sesija 00:43 — korak 39: Health paketi i čitanje (odluka 94b)
- #1: zadnje Codexovo `CODEX_APPROVED` za #71; nema otvorenih P0/P1/P2, bug issueja ni otvorenih PR-ova. #70 čeka zaseban Codexov pregled.
- Plan A (`wip/korak-39-health-paketi`, HIGH_RISK: `package.json`, `app.json`; mali PR): (1) paketi `@kingstinct/react-native-healthkit` + `react-native-nitro-modules` (iOS), `react-native-health-connect` (Android, Expo plugin u paketu), `expo-build-properties` (Android `minSdkVersion` 26 — Health Connect); samo čitanje: HealthKit bez pisanja i bez background-delivery, Android `READ_SLEEP`/`READ_STEPS`/`READ_ACTIVE_CALORIES_BURNED`; provjereno `expo prebuild` u privremenoj kopiji; (2) čisto mapiranje u `src/core/health/source.ts` (HealthKit/Health Connect faze sna → `SleepSample`, raspon upita noći i dana) s testovima; (3) `src/features/health/health-source.ts`: opcionalno učitavanje (stari dev build bez native dijela → „nije dostupno“, bez rušenja), `requestHealthRead`, `readHealthNight(wakeDate)`, `readHealthTotal('steps'|'activeKcal', date)`; testovi s lažnim modulima.
- Gotovo: (1)–(3) u PR-u #72. Treba **novi development build** (`npx expo run:ios --device`); HealthKit s osobnim timom provjeriti na Macu.
- Plan B (`wip/korak-39-health-ui`, HIGH_RISK: ne): (1) Profil → „Zdravlje“: prekidač samo na uređaju (`device-prefs`, bez migracije), isključen dok ga korisnik ne uključi; uključivanje traži dopuštenje, nedostupan Health → ostaje isključen uz objašnjenje; (2) jutarnji upit: dok korisnik nije dirao vremena i nema upisanog sna, noć iz Healtha zamijeni ciljeve uz „Popunjeno iz: Zdravlje — provjeri pa spremi“; spremanje ostaje korisnikovo; (3) tracker kalorija: „Potrošeno (aktivno)“ i koraci danas iz Healtha, samo prikaz (ne mijenja rezultat ni dijagnozu).
- Gotovo: (1)–(3) u PR-u #73. Korak 39 `[x]` (provjera na iPhoneu s novim buildom). Sljedeće: 41 widget kad Apple račun bude aktivan (App Group) — Android widget ne čeka.

- Odluke Borne 2026-11-19 (92 stari XP ostaje, 93 Apple diktiranje, 94a Apple Developer Program → iOS i Android widget, 94b Health: san, koraci, aktivne kcal) i korak 34c su u arhivi.
- Odluke Borne 2026-11-18 (pitanja 75–91), sesije 09:43, 12:43 i 21:43 (2026-11-19) su u arhivi.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. Ž11, 33, 32b, 31f i 34c gotovi — provjeriti na iPhoneu.
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 24 (Google Calendar — OAuth tajne).
3. Svi koraci faza 1–3 osim 24 su gotovi. Faza 4 (39, 41) čeka pitanje 94; dotad samo čista logika (`src/core/widget`, `src/core/health`).

## Pitanja za Bornu
- 92–94 odgovorena 2026-11-19 (arhiva).
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`, `income`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. ~~Deploy Edge Functions~~ — **deployano 2026-11-18 (Codex)**. Nakon PR-a s modelom i PR-a #68 (odgovori na pitanja) treba ponovo deployati (`npx supabase functions deploy plan-day`). Živi probni poziv čeka prijavljenog korisnika (migracije, pitanje 84).
- Pitanja 75–91 odgovorena 2026-11-18 (gore, „Odluke Borne“); 87 i 88 bez odgovora → ostaje kako je. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
