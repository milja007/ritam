# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-17 · Sesija 18:43 (nastavak) — korak 34: epski questovi
Plan: (1) PR podataka (HIGH_RISK): domena `quest.ts` (etape kao JSON u retku, stanje active/done/archived), core `quests.ts` (XP 15 po etapi, 100 za ostvaren quest, najviše 3 u tijeku, redoslijed, rok), lokalna tablica `quests` + okidači synca (0011), Supabase migracija `20261117180000_quests.sql` (RLS, `synced_at`, tombstone) — **remote primjena je Bornina (pitanje 84)**, repo s usklađivanjem XP-a bez duplikata, testovi (domena, repo, sync, `test:supabase`). (2) PR UI-ja: kartica „Epski questovi“ na Profilu umjesto „uskoro“ + uređivač, HR/EN.

## 2026-11-17 · Sesija 18:43 — korak 34 (dio): freeze tokeni „žeravica“
Plan (stanje #1: nema P0/P1, nema otvorenih PR-ova ni bug issueja):
1. Core `streak.ts`: freeze tokeni izvedeni iz povijesti (ne spremaju se, kao XP): 1 žeravica za svakih 7 ubrojenih dana zaredom, najviše 2; propušten dan premošćuje se žeravicom (troši se, dan ne povećava niz); nedovoljno žeravica → niz pukne, žeravice ostaju. Vrijedi svugdje gdje se računa niz (`streakFromDates`).
2. `Streak.freezes`: `held`, `nextIn`, `savedDates` (premošteni dani trenutnog niza, uključivo dane do danas koje žeravica čuva). Testovi za rubove.
3. UI Profil: red „Žeravica“ ispod niza (2 utora, upaljena/ugašena, sljedeća za N dana, „sačuvala niz: datumi“), bljesak kad se zaradi nova; poruka uz niz kad ga žeravica drži. HR/EN, VoiceOver, smanji kretanje.
4. Pragovi (7 dana, max 2) nisu u konceptu → pitanje 85 za Bornu (ne blokira).
Epski questovi (traže tablicu + remote migraciju) — zasebni PR.

## 2026-11-17 · Sesija 15:43 (nastavak) — korak 27 „Nešto je iskrslo“, PR #29
- Core `planUnexpected` (prozor od sada; pogođeni = planirani osim sna koji se preklapaju; kasnije danas = prvi slobodan termin iste duljine, redom, do 23:59). DB `applyUnexpected` (jedna transakcija, ponovno računa iz baze; `moved` + kopija / `skipped` / novi termin; razlog kao bilješka ako je nema; +5 XP najviše jednom dnevno, `sourceId` null).
- Večernji upit više ne pita blok premješten tijekom dana bez spremljenog odgovora (inače dupla kopija).
- UI `UnexpectedFlow` (modal) + gumb na Danu; HR/EN. Akcija „Iskrslo“ na obavijesti i dalje otvara uređivač (dira obavijesti — zasebno).

## 2026-11-17 · Sesija 15:43 — 37 „zadnjih 7 dana“ + 23 (dio), PR #28
- **37**: zadnji dan mjeseca koji nije nedjelja → ispod dnevne „Zadnjih 7 dana“ (naspram 7 prije), pa mjesečna. `previewRollingWeek` samo čita (ne sprema, bez prijedloga, bez niza boljih tjedana); napomena da nova promjena stiže nedjeljom.
- **23 (dio)**: README za Ritam; nema TODO-ova; `expo-doctor` 18/20 (Expo API blokiran u cloudu — ponoviti na Macu). Ostaje `[~]` do deploya 20–22.
- Issue #1 je zatvorio GitHub jer je opis PR-a #26 imao „FIXES: <URL #1>“ — ponovno otvoren; `FIXES` ide samo u objavu u #1, ne u opis PR-a.

## Odluke (Borna, 2026-11-15) — 79 Skia da (paket na Macu), 81 tema s računom, 82 tjedna uz dnevnu + obavijest, 83 mjesečna kao smjer. Detalji u arhivi.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-17 15:45): nema P0/P1 ni otvorenih P2 (PR #22 → #26, PR #16 → #27; model: pitanje 77).

## Sljedeće
0. **Odluka 81** — kod spojen (PR #25); ostaje remote migracija (pitanje 84) — **ne uključivati `EXPO_PUBLIC_FEATURE_AUTH` prije primjene**.
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): okviri avatara / animacije „Gotovo“ kao otključavanja (pitanje 80); **34** epski questovi i freeze tokeni (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (P2 nalazi Codexa, testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
85. **Žeravica (freeze tokeni, korak 34)** — pravila nisu u konceptu, odabrano: 1 žeravica za svakih 7 dana zaredom, najviše 2, troši se automatski za propušten dan (dan ne povećava niz); ako rupa ima više dana nego žeravica, niz pukne, a žeravice ostaju. Vrijedi za glavni niz svugdje (Profil, Dan, bedževi, orb, dijagnoze). Naziv u UI-ju „Žeravica“ / „Banked ember“. U redu? Promjena je jedna konstanta.
84. **Remote migracije `color_theme` (odluka 81) i `quests` (korak 34)** — Claudeov alat ne smije primijeniti. Na Macu: `npx supabase db push` (primijeni `20261117010000_color_theme.sql` i `20261117180000_quests.sql`). Dok nisu primijenjene, sync ne smije biti uključen.
86. **Epski questovi (34)** — pravila nisu u konceptu, odabrano: quest = naslov, zašto, okvirni rok (neobavezan), do 12 etapa; najviše 3 u tijeku; XP 15 po etapi i 100 za ostvaren quest (bez kazni; poništena etapa vraća XP); arhiva čuva XP. U redu?
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY` **i `LLM_MODEL`** (zadani `claude-sonnet-4-5` se povlači 30. 11. 2026. — koji model želiš?), pa `supabase functions deploy parse-input` i `plan-day`.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
