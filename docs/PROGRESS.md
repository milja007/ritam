# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-19 · Sesija 09:43 — korak 30: glasovni unos
- #1: nema otvorenih zahtjeva (Codex odobrio #61 i #62); pitanje 92 bez odgovora → 34c čeka. Nema bug issueja ni otvorenih PR-ova. Preostali nezavršeni koraci: 24 (OAuth tajne — Borna), 30, 39/41 (faza 4). Radim 30.
- Plan: (1) PR A (HIGH_RISK, mali): paket `expo-speech-recognition` 58.x (`npx expo install`, nije u Expo SDK-u, ali verzija prati SDK 58) + config plugin s opisima dopuštenja (mikrofon, prepoznavanje govora). Traži novi development build. (2) `src/core/voice`: jezik appa → locale prepoznavanja (hr-HR, en-US), spajanje diktiranog teksta s već napisanim, odluka smije li se snimati (samo na uređaju — koncept „on-device“). Testovi. (3) `src/ui/voice`: adapter koji ne ruši app kad native modul nije u buildu (stari dev build) — mikrofon se tad ne prikazuje; gumb mikrofona (a11y, haptika, „smanji kretanje“), HR/EN. (4) Spojiti na „Što imaš sutra?“ / plan za danas (tekst → postojeći `parse-input` ili lokalni unos), „Odustajem — što se dogodilo“ i komentare u večernjem upitu.
- Gotovo: (1) PR #63; (2)–(4) PR #64; 30 `[x]`. Nalaz iz paketa: iOS `requiresOnDeviceRecognition` vrijedi samo ako jezik ima model na uređaju, inače iOS tiho koristi Appleov poslužitelj (isto kao mikrofon na tipkovnici) — zadržano, pitanje 93.

## Odluke Borne (anketa u chatu, 2026-11-18 ~22:00)
- 89/91 (dijagnoze riječima): **u redu** — model piše tekst, promjenu/smjer bira app, samo svjež period.
- 90 (trackeri): u redu, **plus prihodi** — praćenje prihoda kao opcija, **isključeno po defaultu** (uključuje se u Profilu). → novi korak 31f.
- 85 (žeravica), 76 (rang), 75 (drugi račun ostaje blokiran), 78 (bedževi): **u redu, ostaje**.
- 86 (questovi): **„samo badge“** — tumačenje: ostvaren quest daje bedž, **bez XP-a** za etape i quest. → korak 34c.
- 80 (otključavanja): **dodati okvire avatara i animacije „Gotovo“** kao nagrade po razini. → korak 32b.
- Modeli (korak 40): **bez DeepSeeka**; „najjeftiniji, ali dobar za ovo“ → `parse-input` i `plan-day` Haiku 5.5, `write-report` Sonnet 5.5. `plan-day` treba ponovni deploy.
- 88 (zabrane) i 87 (wind-down po koraku): bez odgovora → ostaje kako je; wind-down i dalje prati ciljani krevet.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. Ž11, 33, 32b i 31f gotovi — provjeriti na iPhoneu. 34c čeka pitanje 92.
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 24 (Google Calendar — OAuth tajne).
3. Iza 30: 34c (pitanje 92), faza 4 (39, 41) i P2 nalazi Codexa kad stignu.

## Pitanja za Bornu
93. **Glasovni unos i privatnost:** app traži prepoznavanje na uređaju, ali iOS za jezik bez modela na uređaju (možda hrvatski) šalje zvuk Appleu, kao diktiranje na tipkovnici. Ostaviti tako ili sakriti mikrofon kad prepoznavanje ne može ostati na uređaju? Dok nema odgovora, ostaje kako je.
92. **34c questovi „samo badge“:** ako maknem XP za etape i quest, postojeći XP iz questova nestaje i razina može pasti (koncept: bez kazni). Prijedlog: novi questovi bez XP-a, već dodijeljeni XP ostaje. U redu? Dok nema odgovora, questovi ostaju kako jesu.
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`, `income`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. ~~Deploy Edge Functions~~ — **deployano 2026-11-18 (Codex)**. Nakon PR-a s modelom `plan-day` treba ponovo deployati (`npx supabase functions deploy plan-day`). Živi probni poziv čeka prijavljenog korisnika (migracije, pitanje 84).
- Pitanja 75–91 odgovorena 2026-11-18 (gore, „Odluke Borne“); 87 i 88 bez odgovora → ostaje kako je. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
