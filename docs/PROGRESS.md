# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-14 · Sesija 06:43 — razine, otključavanja i teme boja (koraci 32, 38, dio 35)
Stanje #1: nema P0/P1; Codex odobrio #15, #16, #17, #19. P2 nalazi za #16 (plan-day, parse-input, logiranje, model) idu uz dovršavanje 20–22, kako Codex traži.
Plan (koncept: „svaki level otključava nešto vidljivo: novu temu boja, … novi naslov“; „orb mijenja boju s novim temama“; level up „full-screen: traka se napuni, burst čestica, broj se odbroji“):
1. **38 — teme boja plamena**: `src/core/theme/flame.ts` — paleta plamena (11 boja) po temi: Žar (zadana), Zora, Modri plamen, Polarna svjetlost, Sumrak; iste svjetline, drugi ton. Akcent, žarovi, traka dana, orb i orb-plamen čitaju paletu teme. Testovi kontrasta za svaku temu i obje sheme.
2. Odabir teme se pamti **na uređaju** (`expo-sqlite/kv-store`, bez migracije i bez novog paketa); `AppThemeProvider` ga čita.
3. **32 — otključavanja**: `src/core/gamification/unlocks.ts` — što koja razina otključava (teme i naslovi), `levelUp(zadnjaViđena, trenutna)`. Izvedeno iz XP-a, ništa se ne sprema osim zadnje viđene razine (na uređaju). Testovi.
4. Profil: „Rang X · Razina N“ i naslov (P35 — broj razine dolazi s otključavanjima), sljedeće otključavanje; kartica „Tema boja“ s uzorcima, zaključane teme pokazuju razinu.
5. **35 — level-up**: slavlje preko cijelog ekrana kad razina naraste (i ako je narasla dok je app bio zatvoren): traka se napuni, iskre, broj se odbroji, popis otključanog. Uz „smanji kretanje“ mirno. Bez haptike (Ž11).
6. Bez kazni: razina i otključano nikad ne padaju. Okviri avatara i animacije „Gotovo“ kao otključavanja ostaju za kasnije.
*Recenzija:* popis otključavanja i razine nisu u konceptu (samo vrste) → pitanje 80, ne blokira. Tema na uređaju, ne u `settings` → ne treba remote migracija; sinkronizacija teme među uređajima ostaje pitanje.

## 2026-11-14 · Sesija 00:43 — orb-plamen avatar na Profilu (korak 33, dio; PR #19)
- **Čista logika** `src/core/gamification/orb.ts` (`orbFlame`): veličina jezgre iz ranga, toplina iz prosjeka **konačnih** rezultata zadnjih 7 dana, iskre iz tekućeg niza (3 / 7 / 30 dana), brzina disanja iz topline. Jednom upaljen plamen bez svježih rezultata tinja (`resting`) — ne gasi se i ne smanjuje. Ništa se ne sprema.
- **UI** `src/ui/orb-flame.tsx`: dva prstena, jezgra (`radial-gradient`), aureola koja diše, žarište koje treperi, iskre koje kruže; bljesak kad se plamen prvi put upali dok je Profil otvoren. Reanimated, bez Skie; uz „smanji kretanje“ sve stoji.
- **Profil**: orb zamjenjuje medaljon u kartici „Rang i statovi“ (platno „Avatar i rang“); uz njega rang, stanje plamena i prosjek 7 dana. Dodir otvara objašnjenje (veličina, sjaj, iskre, „bez kazni“).
- 37c označen `[x]`. **Na uređaju neprovjereno** (izgled provjeren samo na CSS skici istih boja). Sesija 21:43 (PR #18: bedževi, animacije niza i „Gotovo“, listanje) je u arhivi.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, 34b, 37c, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi), magic link, sync s dva uređaja.

## Sljedeće
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): **38 teme boja** (traži stupac u `settings` → remote migracija = Borna; lokalni dio može prije), **32** level-up kad dođu otključavanja, **34** epski questovi (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY`, pa `supabase functions deploy parse-input` i `plan-day`. Preporuka: tek nakon testova i Codexova pregleda PR-a #16.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
79. Orb-plamen (33): pravila nisu u konceptu, odabrana su ovdje (gore). Je li u redu da sjaj prati zadnjih 7 dana, a iskre niz (3 / 7 / 30)? Želiš li Skia verziju (pravi plamen) — treba `npx expo install @shopify/react-native-skia` na Macu.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
