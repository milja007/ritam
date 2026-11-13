# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-13 · Sesija 18:43 — korak 34b + dio koraka 35 (PR #17)
- **34b Rang i statovi** (po platnu „Profil“), sve iz lokalnih podataka:
  - `src/core/gamification/rank.ts`: rang E→S iz broja **dobrih tjedana** — zaključen tjedan (pon–ned) s ≥ 4 konačna rezultata koji je bolji od prethodnog ubrojenog ili ima prosjek ≥ 70. Pragovi ukupno: D 2, C 5, B 9, A 14, S 20. Rang nikad ne pada.
  - `stats.ts`: Disciplina = plan, Volja = zabrane, Energija = san; 0–100 je prosjek tog dijela **konačnog** rezultata zadnjih 30 dana. Zdravlje i Novac čekaju trackere (31b).
  - `ScoredDay.parts` (neobavezno) — `listDayScores` samo prosljeđuje dijelove koje je već računao (čitanje, bez migracije).
  - Profil: kartica „Rang i statovi“ (`features/ember/rank-card.tsx`) — medaljon čiji sjaj raste s rangom, žarovi do sljedećeg ranga, „[Sustav]“ poruka + pravilo, trake statova u boji žara. `ProfileEmberCards` dijeli jedno čitanje s „Zadnjih 30 dana“.
- **35 (dio, bez haptike):** „+N XP“ iskoči uz XP traku na Danu kad XP naraste dok je ekran otvoren (`xpGain`, `XpPop`, `useXpGain`); uz „smanji kretanje“ samo blijedi; dobitak se javlja čitaču zaslona.
- Bez broja razine (P35). **Na uređaju neprovjereno** (cloud nema simulator; web export pada na `expo-sqlite`).
- Issue #1 je bio zatvoren (GitHub ga je zatvorio uz merge PR-a #15) — ponovo otvoren; u opis PR-a ne pisati „fixes #1“.

## 2026-11-13 · Sesija 15:43 — koraci 20–22, kod spojen (PR #16 `39f6724`), **nije dovršeno**
- `supabase/functions/_shared/{cors,llm-provider}.ts`, `parse-input`, `plan-day`, `src/core/schedule/edge-types.ts`; `tsconfig.json` isključuje `supabase/**`.
- Ostaje prije `[x]`: funkcije nisu deployane, nemaju testove (fallback pravila `plan-day` treba izvući u `src/core` i pokriti), `parse-input` nije spojen na korak 13, validacija plana u appu ne postoji. Codex ih još nije pregledao.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, Ž1–Ž10 i Ž12; kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (rang, statovi), magic link, sync s dva uređaja.

## Sljedeće
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): **38 teme boja** (traži stupac u `settings` → remote migracija = Borna; lokalni dio može prije), **34 bedževi** po platnu Profila (čisto iz rezultata i niza), **32** level-up kad dođu otključavanja.
3. Dovršiti 20–22 (testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY`, pa `supabase functions deploy parse-input` i `plan-day`. Preporuka: tek nakon testova i Codexova pregleda PR-a #16.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
