# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## Odluke (Borna, 2026-11-15, chat) — pitanja 79, 81, 82, 83
- **79 Orb-plamen:** pravila u redu (sjaj = prosjek zadnjih 7 dana, iskre = niz 3 / 7 / 30). **Skia: da** — pravi plamen. Paket instalira Borna na Macu (`npx expo install @shopify/react-native-skia`, zajedno s `expo-haptics` za Ž11) i radi novi development build; dok paket nije u `package.json`, orb bez Skie ostaje.
- **81 Tema boja:** **sinkronizirati s računom** — stupac za temu u `settings` + migracija. Borna odobrava ovu remote migraciju (samo taj stupac); primijeniti tek kad migracija i `npm run test:supabase` prođu lokalno.
- **82 Tjedna dijagnoza:** **oboje** — nedjeljom se tjedni dio pokaže odmah ispod dnevne dijagnoze nakon večernjeg upita, **i** obavijest kad je tjedna dijagnoza spremna. Kartica na tabu Tjedan ostaje.
- **83 Mjesečna dijagnoza:** **u redu, smjer** — najviše 2 ideje kao smjer, bez prihvaćanja; nove promjene i dalje jedna po jedna kroz tjednu.

## 2026-11-14 · Sesije 12:43 i 15:43 — mjesečna dijagnoza (korak 37, PR #22)
- **Pragovi po razdoblju**: graditelji redaka tjedne dijagnoze primaju `PeriodThresholds` (tjedan isti kao prije).
- **Logika** (`month-diagnosis.ts`, `local-month-v1`): trend naspram prošlog mjeseca, rekord (raniji mjeseci s ≥ 10 zaključenih dana), najslabiji/najjači dan u tjednu, prva naspram druge polovice, pregled odgovora na tjedne prijedloge tog mjeseca. **Najviše dvije ideje kao smjer**, bez „Probat ću“ — nove promjene i dalje po jedna kroz tjednu (pitanje 83).
- **Spremanje**: `generateMonthReport` u `reports` (`period = 'month'`, `periodStart` = 1. u mjesecu, `suggestion = null`), bez migracije; dostupna kad mjesec prođe ili zadnji dan nakon večernjeg upita; bez promjene ništa ne piše.
- **Tab Mjesec**: kartica „Dijagnoza mjeseca“ ispod usporedbe → modal s cijelom dijagnozom (datumi kao „12. studenoga“, dani u tjednu riječima). HR/EN.
- **P2 Codexa za PR #21**: odgovor na tjedni prijedlog čuva se samo kad je i konkretna ideja (parametri: zabrana, okidač) ista.
- Na uređaju neprovjereno.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, 32, 34b, 36 i 37 (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna i mjesečna dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-14 15:45): nema P0/P1; P2 za PR #21 riješen u PR-u #22. P2 nalazi Codexa za PR #16 (plan-day: fiksni blok ne rezervira vrijeme, predug prvi zadatak, blok izvan prozora, vrijeme 99:99; `null` u tijelu → 400; logiranje bez `waitUntil`; Sonnet 4.5 se povlači 30. 11.) rješavaju se uz dovršavanje 20–22.

## Sljedeće
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): okviri avatara / animacije „Gotovo“ kao otključavanja (pitanje 80); **34** epski questovi i freeze tokeni (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (P2 nalazi Codexa, testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY`, pa `supabase functions deploy parse-input` i `plan-day`. Preporuka: tek nakon testova i Codexova pregleda PR-a #16.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
