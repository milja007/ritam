# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-14 · Sesija 09:43 — tjedna dijagnoza (korak 36) + P2 level-up (PR u tijeku)
Plan (provjeren protiv koncepta „Dijagnoze“ i „Napredak u odnosu na prošlost“):
1. **P2 Codexa za PR #20** (`level-up-host`): kad `pending` nestane, „prikazano“ se briše, pa ponovni prikaz opet čeka fokus, zatvorene modale i pauzu. Čista funkcija + test.
2. **Niz boljih tjedana** (`src/core/progress/better-weeks.ts`): zaključeni tjedni zaredom jednako dobri ili bolji od prethodnog (isti tjedni kao rang: ≥ 4 konačna rezultata; preskočen tjedan prekida niz).
3. **Statistika tjedna** (`src/core/diagnosis/period-stats.ts`): zbroj `DayStats` zaključenih dana — plan, zabrane po zabrani i okidaču, san, XP, ocjena, najbolji/najslabiji dan, propusti po dobu dana, ponovljeni propusti, kratki san naspram rezultata. Općenito po razdoblju, da ga mjesec (37) može ponovno koristiti.
4. **Tjedna dijagnoza** (`week-diagnosis.ts`, `local-week-v1`): šest sekcija istim redom; trend naspram prošlog tjedna; **jedna** promjena tjedno; odbijena se ne nudi 2 tjedna; prihvaćena ostaje 2 tjedna („ostani na istoj“) i dijagnoza kaže je li upalila.
5. **Spremanje** u postojeću tablicu `reports` (`period = 'week'`, bez migracije; lokalno i remote već dopuštaju `week`) — `generateWeekReport`, odgovor na prijedlog. `src/db/**` → HIGH_RISK.
6. **Tab Tjedan**: kartica „Dijagnoza tjedna“ za zaključen tjedan (ili nedjelju nakon večernjeg upita) → modal s dijagnozom i gumbima „Probat ću“ / „Ne sada“; niz boljih tjedana u kartici. HR/EN, pristupačnost.
7. Ako ostane vremena: mjesečna dijagnoza (37) na istoj statistici.

## 2026-11-14 · Sesija 06:43 — razine, otključavanja, teme boja, level-up (koraci 32, 38, dio 35; PR #20)
- **38 teme boja**: `src/core/theme/flame.ts` — pet paleta plamena iste svjetline (Žar, Zora, Modri plamen, Polarna svjetlost, Sumrak). Tema mijenja akcent, žarove, traku dana, odsječke tjedna, orb i orb-plamen (`theme.flame`); pozadine, tekst i statusne boje ostaju. Odabir se pamti **na uređaju** (`src/ui/device-prefs.ts` → `expo-sqlite/kv-store`), bez migracije i bez novog paketa.
- **32 otključavanja**: `src/core/gamification/unlocks.ts` — razine otključavaju teme i naslove; Profil: „Razina N · naslov“, XP do sljedeće razine, što ona otključava; kartica „Tema boja“ (zaključana tema pokazuje razinu).
- **35 level-up**: `src/features/unlocks/` — slavlje preko cijelog ekrana na Danu (traka → odbrojavanje razine → prasak iskri → popis otključanog, „Isprobaj temu“). Zadnja viđena razina se pamti na uređaju i mijenja tek zatvaranjem slavlja; čeka da se ostali modali zatvore. Postojeći korisnik pri prvom pokretanju ne dobiva slavlje (razina se samo zabilježi).
- Stanje #1: nema P0/P1. **P2 nalazi Codexa za PR #16** (plan-day: fiksni blok ne rezervira vrijeme, predug prvi zadatak troši prozore, blok izvan prozora i vrijeme 99:99; `null` u tijelu → 400; logiranje bez `waitUntil`; Sonnet 4.5 se povlači 30. 11.) rješavaju se uz dovršavanje 20–22, kako Codex traži.
- **Na uređaju neprovjereno** (boje provjerene samo na statičnoj skici). Sesija 00:43 (PR #19, orb-plamen) je u arhivi.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, 32, 34b, 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, magic link, sync s dva uređaja.

## Sljedeće
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): **36** tjedna dijagnoza (lokalna, kao dnevna) i streak boljih tjedana; okviri avatara / animacije „Gotovo“ kao otključavanja (pitanje 80); **34** epski questovi i freeze tokeni (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (P2 nalazi Codexa, testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY`, pa `supabase functions deploy parse-input` i `plan-day`. Preporuka: tek nakon testova i Codexova pregleda PR-a #16.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
79. Orb-plamen (33): pravila nisu u konceptu, odabrana su ovdje (gore). Je li u redu da sjaj prati zadnjih 7 dana, a iskre niz (3 / 7 / 30)? Želiš li Skia verziju (pravi plamen) — treba `npx expo install @shopify/react-native-skia` na Macu.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
81. Tema boja (38) se pamti samo na uređaju. Treba li se sinkronizirati s računom (stupac u `settings` → remote migracija)?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
