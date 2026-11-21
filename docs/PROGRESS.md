# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-21 · Borna: migracije i deploy gotovi (chat)
- Odgovor na 84 i 77 (Borna, chat 2026-11-21): na Macu primijenjeno svih 7 remote migracija (`db push`, dry-run prije i poslije), deployani `plan-day`, `parse-input`, `write-report`; `ANTHROPIC_API_KEY` postoji. Claude provjerio preko Supabase MCP-a (samo čitanje): remote ima 14 migracija do `20261119030000_income`, sve 3 funkcije `ACTIVE`, verzija 2.
- Supabase CLI 2.90 ne razumije trenutni `config.toml` — korišten CLI 3.2 uz eksplicitni `--remote` (README dopunjen).
- iOS dev build radi na simulatoru (iPhone 17 Pro): Profil, orb-plamen, rang, teme OK; Zdravlje uključeno. Lokalni `.env` s `EXPO_PUBLIC_FEATURE_AUTH=1` (sync smije biti uključen jer je 84 riješeno).
- Još na uređaju: magic link, stvarni „Složi mi dan“, san iz Healtha. `expo install --check`: 14 Expo paketa ima noviji SDK 58 patch — zaseban PR.

## 2026-11-20 · Sesija 15:43 — provjera stanja, nalaz za Android widget
- #1: od zadnje objave (#79) nema novih komentara; nema P0/P1, bug issueja ni otvorenih PR-ova. Svi koraci bez Borne su gotovi (pokrivenost `src/core` 99,6 % linija).
- Nalaz (pregled `expo-widgets` 58.0.29, Android dio): Glance widget nema zadanu radnju na dodir, a paket ne nudi „otvori app“ (samo gumbi s `target` koji se obrađuju u pozadini, bez pokretanja appa). **Dodir na Android widget „Ritam — Dan“ zato ne otvara Ritam.** iOS widget otvara app (zadano ponašanje WidgetKita). Popravak traži native kod (vlastiti `AppWidgetProvider` kroz `plugins/with-ritam-widgets.js` s `PendingIntent.getActivity`) koji se ovdje ne može buildati ni provjeriti — pitanje 95.

- Sesija 12:43 (2026-11-20, Android widget u pozadini) je u arhivi.
- Sesije 00:43, 06:43 i 09:43 (2026-11-20: koraci 39 i 41, sažetak pitanja) su u arhivi.
- Odluke Borne 2026-11-19 (92 stari XP ostaje, 93 Apple diktiranje, 94a Apple Developer Program → iOS i Android widget, 94b Health: san, koraci, aktivne kcal) i korak 34c su u arhivi.
- Odluke Borne 2026-11-18 (pitanja 75–91), sesije 09:43, 12:43 i 21:43 (2026-11-19) su u arhivi.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); koraci 20–22.
- Remote Supabase `ritam`: 14 migracija (zadnja `20261119030000_income`, 2026-11-21), Edge Functions `parse-input`, `plan-day`, `write-report` deployane. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.

## Sljedeće
0. Remote migracije primijenjene (2026-11-21) — auth/sync smije biti uključen; provjeriti magic link i sync s dva uređaja.
1. Ž11, 33, 32b, 31f i 34c gotovi — provjeriti na iPhoneu.
2. 20–22, 26 i 31 su u appu, funkcije deployane 2026-11-21; 31b gotov. Faza 2 što ostaje traži Bornu: 24 (Google Calendar — OAuth tajne).
3. Svi koraci faza 1–3 osim 24 su gotovi. Faza 4: 39 gotov, 41 Android gotov, iOS kod gotov — aktivacija čeka Apple račun (App Group). Android widget se osvježava i u pozadini (~15 min, 2026-11-20). Bez Borne više nema koraka; stara pitanja sažeta 2026-11-20.

## Pitanja za Bornu
Blokiraju rad:
- ~~84 remote migracije~~ i ~~77 deploy `plan-day`~~ riješeni 2026-11-21 (Borna).
- 24 (Google Calendar) čeka OAuth tajne; 41 iOS čeka aktivan Apple račun (App Group).

Ne blokiraju (stara pitanja bez odgovora, sažeta 2026-11-20; bez odgovora app ostaje kako je — tekst pitanja u arhivi, `grep -n "^NN\." docs/PROGRESS-ARCHIVE.md`):
- **Store/build:** 46 bundle id `com.milja007.ritam` ostaje i za App Store? (sad je relevantno uz Apple račun) · 47 Xcode ≥ 26.4 umjesto patcha — vjerojatno riješeno ako build prolazi.
- **Sync/račun:** 44 samo nedestruktivne migracije bez Borne (praksa već takva) · 72 magic link samo na istom uređaju ili i 6-znamenkasti kod · 74 automatski push par sekundi nakon promjene?
- **Dan:** 62 ideje iz povijesti (bez „Spremi kao ideju“) · 63 prije 04:00 plan se ne otvara sam · 66 XP/rezultat ispod „Trenutno“ · 67 otkazana aktivnost = neodrađena (ne neutralna) · 69 Odustajem zaključuje dan tek s večernjom ocjenom · 70 večernja obavijest uvijek vodi u večernji upit.
- **Widget:** 95 Android widget se na dodir ne otvara (ograničenje `expo-widgets` 58). Čekati novu verziju paketa ili da Claude doda native popravak kroz config plugin (provjera tek na Android buildu)?
- **Pravila:** 87 wind-down prati ciljani krevet (ne postupni korak) · 88 zabrane po razdoblju, najviše 5, niz.
- Prijedlog: jedna anketa „u redu / promijeni“ za ovih 14; odgovore upisati ovdje s datumom.
