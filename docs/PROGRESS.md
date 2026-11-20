# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-20 · Sesija 09:43 — sažetak otvorenih pitanja
- #1: zadnje su Claudeove objave #75–#77; Codexov zadnji pregled odobrio #73 (P2 popravljen u #75) i #74. Nema P0/P1, bug issueja ni otvorenih PR-ova.
- Svi koraci bez Borne su gotovi. Ova sesija: stara otvorena pitanja (23–94) pregledana u arhivi i sažeta u jedan paket ispod („Pitanja za Bornu“). Odgovoreni skupovi: 1–43, 48–61, 75–86, 89–94.

## 2026-11-20 · Sesije 00:43 i 06:43 — koraci 39 i 41 (PR #72–77)
- 39 gotov (Health: san, koraci, aktivne kcal; treba novi development build). 41: Android widget gotov (treba novi Android build), iOS kod gotov — uključuje se tek uz App Group. Detalji u arhivi.

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
3. Svi koraci faza 1–3 osim 24 su gotovi. Faza 4: 39 gotov, 41 Android gotov, iOS kod gotov — aktivacija čeka Apple račun (App Group). Sljedeće bez Borne: pozadinsko osvježavanje Android widgeta (opcionalno, novi paket); stara pitanja sažeta 2026-11-20.

## Pitanja za Bornu
Blokiraju rad:
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`, `income`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. Edge Functions deployane 2026-11-18 (Codex); nakon PR-a #68 i promjene modela treba ponovo `npx supabase functions deploy plan-day`.
- 24 (Google Calendar) čeka OAuth tajne; 41 iOS čeka aktivan Apple račun (App Group).

Ne blokiraju (stara pitanja bez odgovora, sažeta 2026-11-20; bez odgovora app ostaje kako je — tekst pitanja u arhivi, `grep -n "^NN\." docs/PROGRESS-ARCHIVE.md`):
- **Store/build:** 46 bundle id `com.milja007.ritam` ostaje i za App Store? (sad je relevantno uz Apple račun) · 47 Xcode ≥ 26.4 umjesto patcha — vjerojatno riješeno ako build prolazi.
- **Sync/račun:** 44 samo nedestruktivne migracije bez Borne (praksa već takva) · 72 magic link samo na istom uređaju ili i 6-znamenkasti kod · 74 automatski push par sekundi nakon promjene?
- **Dan:** 62 ideje iz povijesti (bez „Spremi kao ideju“) · 63 prije 04:00 plan se ne otvara sam · 66 XP/rezultat ispod „Trenutno“ · 67 otkazana aktivnost = neodrađena (ne neutralna) · 69 Odustajem zaključuje dan tek s večernjom ocjenom · 70 večernja obavijest uvijek vodi u večernji upit.
- **Pravila:** 87 wind-down prati ciljani krevet (ne postupni korak) · 88 zabrane po razdoblju, najviše 5, niz.
- Prijedlog: jedna anketa „u redu / promijeni“ za ovih 13; odgovore upisati ovdje s datumom.
