# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-18 · Sesija 00:43 (2) — korak 22 u appu, PR #36
1. `plan-day` dobiva `locale` (stari klijent → hr); lokalni raspored i prompt pišu sažetak/pitanja na tom jeziku. Test.
2. Core `src/core/schedule/plan-day-client.ts`: zahtjev iz stavki (stavka s izričitim vremenom ili naučena = `fixedStart`, ostale fleksibilne s trajanjem), slobodni prozori = od buđenja + 30 min do odlaska u krevet minus postojeći blokovi (≥ 15 min, najviše 12), provjera odgovora u appu (HH:MM, bez preklapanja, unutar prozora ili točno fiksna stavka; ≤ 3 pitanja), prijedlog → nacrti (vrsta iz stavke) + popis stavki koje nisu stale. Testovi.
3. UI „Što imaš sutra?“: s oblakom gumb „Složi mi dan“ (≥ 2 stavke) → prijedlog (sažetak, raspored, „nije stalo“, pitanja) → „Prihvati prijedlog“ zamijeni stavke (one koje nisu stale ostaju) ili „Natrag na moj popis“; plan postaje plan tek na Potvrdi (odobrenje). Greška → poruka, popis ostaje. HR/EN, pristupačnost.
4. Bez oblaka se ništa ne mijenja (gumb se ne prikazuje).

## 2026-11-18 · Sesija 00:43 — koraci 20–22 u appu (prioritet „Žar“ istekao 17. 11.)
1. **20 — model po funkciji** prema Borninoj odluci 2026-11-09 (arhiva): `parse-input` → `claude-haiku-5-5`, `plan-day` → `claude-sonnet-5-5`; čista funkcija `llmModelFor(fn, env)` u `_shared/plan-logic.ts` (override `LLM_MODEL_PARSE_INPUT` / `LLM_MODEL_PLAN_DAY`), test. Zatvara P2 5 (Sonnet 4.5 se povlači) bez čekanja Borne — model je već odabran; ostaje samo deploy.
2. **21 — app validira odgovor** `parse-input` (`src/core/schedule/parsed-input.ts`): nevaljani blokovi otpadaju, najviše 20; `parsedBlocksToDrafts` → `BlockDraft` (od–do / početak + trajanje / doba dana / prvi slobodan termin), termini se ne preklapaju s već dodanim. Testovi.
3. **21 — lokalni višestruki unos**: „Trening 18-19, zubar u 15; kemija 45 min“ → tri stavke bez LLM-a (dijeli se samo na `,` `;` i novi red). Testovi.
4. **21 — spoj na korak 13**: „Što imaš sutra?“ — kad je oblak uključen i postoji sesija, unos s više stavki ide kroz `parse-input` (timeout 8 s); inače / na grešku lokalno. Gumb pokazuje učitavanje, čitač čuje „Dodano N“. Bez oblaka ponašanje je kao prije (osim višestrukog unosa).
5. **22 — sljedeći PR**: klijent `plan-day` + prijedlog plana s pitanjima i odobrenjem.
- Gotovo 1–4 (PR #35). Deploy funkcija ostaje Borni (pitanje 77, sada samo deploy). Sljedeće: 22 u appu.

## Odluke (Borna, 2026-11-15) — 79 Skia da (paket na Macu), 81 tema s računom, 82 tjedna uz dnevnu + obavijest, 83 mjesečna kao smjer. Detalji u arhivi.

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

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
87. **San (29)** — pragovi nisu u konceptu, odabrano: kratka noć = barem 1 h manje od cilja, jako kratka = 2 h; „Lakše jutro“ samo predlaže (otvara „Nešto je iskrslo“ s razlogom „Loš san“, 1 h), ne mijenja plan samo. Krevet: ako zadnjih noći (≥ 3) kasniš > 15 min, večerašnji cilj je ~15 min ranije od navike, korak po korak do cilja. Želiš li da i **wind-down obavijest** prati taj korak (umjesto ciljanog kreveta)?
85. **Žeravica (freeze tokeni, korak 34)** — pravila nisu u konceptu, odabrano: 1 žeravica za svakih 7 dana zaredom, najviše 2, troši se automatski za propušten dan (dan ne povećava niz); ako rupa ima više dana nego žeravica, niz pukne, a žeravice ostaju. Vrijedi za glavni niz svugdje (Profil, Dan, bedževi, orb, dijagnoze). Naziv u UI-ju „Žeravica“ / „Banked ember“. U redu? Promjena je jedna konstanta.
84. **Remote migracije `color_theme` (odluka 81) i `quests` (korak 34)** — Claudeov alat ne smije primijeniti. Na Macu: `npx supabase db push` (primijeni `20261117010000_color_theme.sql` i `20261117180000_quests.sql`). Dok nisu primijenjene, sync ne smije biti uključen.
86. **Epski questovi (34)** — pravila nisu u konceptu, odabrano: quest = naslov, zašto, okvirni rok (neobavezan), do 12 etapa; najviše 3 u tijeku; XP 15 po etapi i 100 za ostvaren quest (bez kazni; poništena etapa vraća XP); arhiva čuva XP. U redu?
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): ključ je već u secrets (2026-11-09), model je tvoja odluka od 2026-11-09 i sada je u kodu (`parse-input` Haiku 5.5, `plan-day` Sonnet 5.5). Ostaje samo na Macu: `npx supabase functions deploy parse-input` i `plan-day` — kad uključiš oblak.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
