# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-14 · Sesija 12:43 (nastavak) — mjesečna dijagnoza (korak 37, PR u tijeku)
Plan (provjeren protiv koncepta „Dijagnoze“: isti red sekcija; „najviše 1 nova promjena tjedno, 2 mjesečno“):
1. **Pragovi po razdoblju**: graditelji redaka tjedne dijagnoze primaju pragove (`WEEK_THRESHOLDS`, `MONTH_THRESHOLDS`), bez promjene tjednog ponašanja (postojeći testovi moraju proći netaknuti).
2. **Mjesečna dijagnoza** (`month-diagnosis.ts`, `local-month-v1`): trend naspram prošlog mjeseca, rekord mjeseca, uzorak po danu u tjednu, prva naspram druge polovice mjeseca, pregled promjena prihvaćenih u tjednim dijagnozama tog mjeseca. Ideje: **najviše dvije, kao smjer** — bez „Probat ću“; nove promjene i dalje dolaze jedna po jedna kroz tjednu dijagnozu, da mjesec ne zaobiđe pravilo „1 tjedno“ (pitanje 83).
3. **Spremanje**: `generateMonthReport` u `reports` (`period = 'month'`, `periodStart` = prvi dan mjeseca), bez migracije; dostupna kad mjesec prođe ili zadnji dan nakon večernjeg upita. `src/db/**` → HIGH_RISK.
4. **Prikaz**: zajednički prezentacijski `PeriodDiagnosisView` / kartica (tjedan ga počinje koristiti), kartica „Dijagnoza mjeseca“ na tabu Mjesec. HR/EN.

## 2026-11-14 · Sesije 09:43 i 12:43 — tjedna dijagnoza (korak 36) + P2 level-up (PR #21, `0116a67`)
- Lokalna tjedna dijagnoza `local-week-v1` (`src/core/diagnosis/week-diagnosis.ts`, statistika u `period-stats.ts`), niz boljih tjedana (`better-weeks.ts`), spremanje u `reports` (`period = 'week'`, bez migracije; `generateWeekReport`, `answerReportSuggestion`), kartica na tabu Tjedan s „Probat ću“ / „Ne sada“. Detalji u arhivi.
- Nije napravljeno: tjedna nije u nedjeljnoj dnevnoj dijagnozi, nema obavijesti (pitanje 82). Na uređaju neprovjereno.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, 32, 34b, 36 (lokalna), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-14 12:45): nema P0/P1. P2 nalazi Codexa za PR #16 (plan-day: fiksni blok ne rezervira vrijeme, predug prvi zadatak, blok izvan prozora, vrijeme 99:99; `null` u tijelu → 400; logiranje bez `waitUntil`; Sonnet 4.5 se povlači 30. 11.) rješavaju se uz dovršavanje 20–22.

## Sljedeće
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): **37** mjesečna dijagnoza na istoj statistici (`periodStats`; 2 promjene mjesečno) + kartica na tabu Mjesec; okviri avatara / animacije „Gotovo“ kao otključavanja (pitanje 80); **34** epski questovi i freeze tokeni (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (P2 nalazi Codexa, testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY`, pa `supabase functions deploy parse-input` i `plan-day`. Preporuka: tek nakon testova i Codexova pregleda PR-a #16.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
79. Orb-plamen (33): pravila nisu u konceptu, odabrana su ovdje (gore). Je li u redu da sjaj prati zadnjih 7 dana, a iskre niz (3 / 7 / 30)? Želiš li Skia verziju (pravi plamen) — treba `npx expo install @shopify/react-native-skia` na Macu.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
81. Tema boja (38) se pamti samo na uređaju. Treba li se sinkronizirati s računom (stupac u `settings` → remote migracija)?
82. Tjedna dijagnoza (36) se otvara karticom na tabu Tjedan (nedjeljom nakon večernjeg upita i za svaki prošli tjedan). Koncept kaže „nedjelja → dan + tjedan“: želiš li da se nedjeljom tjedni dio pokaže i odmah ispod dnevne dijagnoze, i treba li za nju obavijest?
83. Mjesečna dijagnoza (37) daje najviše dvije ideje kao smjer za idući mjesec, bez „Probat ću“ — nove promjene i dalje nudi samo tjedna dijagnoza (jedna tjedno). Je li to u redu, ili mjesec treba sam nuditi do 2 promjene?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
