# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-13 · Sesija 21:43 — bedževi (34, dio), animacije niza i „Gotovo“ (35, dio), listanje razdoblja (PR #18)
- **Bedževi** (`src/core/gamification/badges.ts`, kartica `features/ember/badges-card.tsx`): 9 bedževa iz konačnih rezultata i niza, ništa se ne sprema, osvojeno se ne gubi. Prvi tjedan (7 ocijenjenih dana), 7 / 30 dana zaredom, 7 dana bez prekršaja, Dan punog sjaja (≥ 85), Rekord tjedna, 4 dobra tjedna zaredom, 30 / 100 žarova. Osvojeni: puni obrub u boji žara; u tijeku: crtkani obrub + „n/m“; dodir pokaže pravilo.
- **Animacija niza** (35): žar u piluli niza na Danu bljesne i broj poskoči kad niz naraste (`streakGain`, `useStreakGain`, `ui/flare.tsx`); javlja se čitaču zaslona.
- **Animacija „Gotovo“** (35): točka na traci dana bljesne kad se aktivnost prijavi kao (napola) odrađena (`shouldFlareDot`, `useDotFlare`).
- **Listanje strelicama** (34b): Tjedan i Mjesec imaju ‹ › i povratak na tekuće razdoblje; unatrag do razdoblja najranijeg rezultata, unaprijed ne dalje od tekućeg (`weekNav`, `monthNav`).
- Sve bez haptike i **na uređaju neprovjereno**. Prethodna sesija (18:43, PR #17: rang, statovi, „+N XP“) je u arhivi.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, 34b, Ž1–Ž10 i Ž12; bedževi (dio 34); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (rang, statovi), magic link, sync s dva uređaja.

## Sljedeće
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): **38 teme boja** (traži stupac u `settings` → remote migracija = Borna; lokalni dio može prije), **32** level-up kad dođu otključavanja, **34** epski questovi (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY`, pa `supabase functions deploy parse-input` i `plan-day`. Preporuka: tek nakon testova i Codexova pregleda PR-a #16.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
