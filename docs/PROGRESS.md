# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-19 · Sesija 15:43 — Codex P2 za vremensku crtu widgeta
- #1: Codex odobrio #65 i #66; jedan P2 za `widget.ts:152` (komentar 7010186119). Nema P0/P1, bug issueja ni otvorenih PR-ova; pitanja 84, 92–94 bez odgovora. Issue #1 se automatski zatvorio mergeom #65 ("Fixes #1" u PR-u) — ponovo otvoren.
- Plan: (1) `fix/widget-timeline-p2`: kad promjena ima više nego što stane (46), zastarjeli zapis („otvori Ritam“) dolazi na prvoj izostavljenoj promjeni umjesto u ponoć; test s 60 blokova (zadnji zapis 11:40, zastarjelost 11:45). Ostalo (24, 34c, 39, 41) čeka Bornu.

## 2026-11-19 · Sesija 12:43 — P2 nalazi diktiranja, zatim faza 4
- #1: Codex odobrio #63 i #64; dva P2 nalaza za `src/ui/dictation.ts` (komentar 7004635027). Nema P0/P1, bug issueja ni otvorenih PR-ova; pitanja 84, 92, 93 bez odgovora.
- Plan: (1) `fix/diktiranje-p2`: zaustavljanje u stanju „starting“ prekida native sesiju (`abort`) ako je `start()` već pozvan; ručno tipkanje tijekom diktiranja prekida diktiranje (rezultati se slažu na početni tekst pa bi izbrisali ispravak). Testovi s lažnim modulom. (2) Zatim faza 4 (39/41) — prvo provjera što SDK 58 nudi.
- Gotovo: (1) PR #65 (spojeno, `b253421`).
- Korak 41 (widget): `expo-widgets` (SDK 58, Expo UI SwiftUI/Compose) radi bez native koda, ali iOS widget traži **App Group**, a besplatni Apple ID (osobni tim, Bornin lokalni build) ga ne podržava — plugin bi srušio potpisivanje. → pitanje 94. Dok čeka: (2) `src/core/widget` — čista logika: što widget pokazuje (Sada / Sljedeće, žar i rezultat dana, niz, odrađeno/ukupno, tekstovi i boje obje sheme jer widget nema i18n ni temu) i vremenska crta za iOS (zapis na svakom početku/kraju aktivnosti, u ponoć „otvori Ritam“). Paket, widget komponenta i osvježavanje iz appa idu nakon odgovora.

- Odluke Borne 2026-11-18 (pitanja 75–91) i sesija 09:43 (korak 30) su u arhivi.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. Ž11, 33, 32b i 31f gotovi — provjeriti na iPhoneu. 34c čeka pitanje 92.
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 24 (Google Calendar — OAuth tajne).
3. Svi koraci faza 1–3 osim 24 i 34c su gotovi. Faza 4 (39, 41) čeka pitanje 94; dotad samo čista logika (`src/core/widget`).

## Pitanja za Bornu
94. **Faza 4 (41 widget, 39 Health) i Apple račun:** iOS widget (`expo-widgets`) treba App Group, a besplatni Apple ID (osobni tim u Xcodeu) ga ne podržava — tvoj lokalni `expo run:ios --device` bi pao na potpisu. Opcije: (a) Apple Developer Program (99 USD/god.) → dodajem iOS widget (i Android); (b) za sada samo Android widget, iOS kasnije; (c) čeka. Za 39: koje podatke čitati iz Apple Health / Health Connect — san (vrijeme odlaska u krevet i buđenja → dio San), koraci, aktivne kalorije (tracker kalorija)? Samo čitanje? HealthKit s osobnim timom treba provjeriti na Macu. Dok nema odgovora radim samo čistu logiku widgeta (bez paketa).
93. **Glasovni unos i privatnost:** app traži prepoznavanje na uređaju, ali iOS za jezik bez modela na uređaju (možda hrvatski) šalje zvuk Appleu, kao diktiranje na tipkovnici. Ostaviti tako ili sakriti mikrofon kad prepoznavanje ne može ostati na uređaju? Dok nema odgovora, ostaje kako je.
92. **34c questovi „samo badge“:** ako maknem XP za etape i quest, postojeći XP iz questova nestaje i razina može pasti (koncept: bez kazni). Prijedlog: novi questovi bez XP-a, već dodijeljeni XP ostaje. U redu? Dok nema odgovora, questovi ostaju kako jesu.
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`, `income`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. ~~Deploy Edge Functions~~ — **deployano 2026-11-18 (Codex)**. Nakon PR-a s modelom `plan-day` treba ponovo deployati (`npx supabase functions deploy plan-day`). Živi probni poziv čeka prijavljenog korisnika (migracije, pitanje 84).
- Pitanja 75–91 odgovorena 2026-11-18 (gore, „Odluke Borne“); 87 i 88 bez odgovora → ostaje kako je. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
