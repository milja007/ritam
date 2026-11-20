# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-20 · Sesija 06:43 — Codex P2 (#73) i korak 41: Android widget
- #1: Codex odobrio #73 (P2: `useHealthTotal` bez osvježavanja pri povratku u app) i #74; nema P0/P1, bug issueja ni otvorenih PR-ova. #70 i #72 čekaju Codexov pregled.
- Gotovo: P2 u PR-u #75 (`AppState` → ponovno čitanje koraka/kcal, prikaz bez treptanja).
- Plan (`wip/korak-41-android-widget`, HIGH_RISK: `package.json`, `app.json`, `plugins/`): (1) `expo-widgets` + lokalni plugin `plugins/with-ritam-widgets.js`: Android widget uvijek; iOS cilj i App Group **samo uz `RITAM_IOS_WIDGET=1`** (dok Apple račun nije aktivan, iOS build s osobnim timom mora proći kao dosad) — provjera `expo prebuild` u privremenoj kopiji za obje platforme; (2) widget „Ritam — Dan“ (Jetpack Compose, `src/widgets/ritam-day.tsx`): žar i rezultat dana, niz, odrađeno/ukupno, Sada / Sljedeće s vremenima, boje obje sheme iz `core/widget`; (3) `src/features/widget`: `WidgetSync` u korijenu — opcionalno učitavanje (stari build → ništa), snimka (`updateSnapshot`) pri promjeni blokova/rezultata, povratku u app i na svakoj sljedećoj promjeni Sada/Sljedeće dok app radi; čista logika `nextWidgetChange` u `core/widget` s testovima. Android nema vremensku crtu: widget pokazuje vremena („Sada · 14:00–15:30“, „Sljedeće 16:00 · …“) da zastarjela snimka ne vara, a datum dana je u widgetu (snimka od jučer se vidi).
- Gotovo: (1)–(3) u PR-u #76. Treba **novi Android build**; iOS build bez zastavice ostaje isti. iOS widget (SwiftUI + vremenska crta) u PR-u #77, uključuje se tek uz App Group: kad Apple račun bude aktivan, na Macu `RITAM_IOS_WIDGET=1 npx expo run:ios --device`.

## 2026-11-20 · Sesija 00:43 — korak 39: Health (PR #72–74, odluka 94b)
- Korak 39 gotov: paketi i dopuštenja samo za čitanje, Profil → „Zdravlje“, san u jutarnjem upitu, koraci/kcal uz tracker. Treba novi development build. Detalji u arhivi.

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
3. Svi koraci faza 1–3 osim 24 su gotovi. Faza 4: 39 gotov, 41 Android gotov, iOS kod gotov — aktivacija čeka Apple račun (App Group). Sljedeće bez Borne: pozadinsko osvježavanje Android widgeta (opcionalno) ili sažetak starih pitanja.

## Pitanja za Bornu
- 92–94 odgovorena 2026-11-19 (arhiva).
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`, `income`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. ~~Deploy Edge Functions~~ — **deployano 2026-11-18 (Codex)**. Nakon PR-a s modelom i PR-a #68 (odgovori na pitanja) treba ponovo deployati (`npx supabase functions deploy plan-day`). Živi probni poziv čeka prijavljenog korisnika (migracije, pitanje 84).
- Pitanja 75–91 odgovorena 2026-11-18 (gore, „Odluke Borne“); 87 i 88 bez odgovora → ostaje kako je. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
