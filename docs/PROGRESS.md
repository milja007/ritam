# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-13 · Sesija 18:43 — plan (korak 34b + dio koraka 35)
Skupina po platnu „Profil“ (rang, „[Sustav]“, statovi), sve iz lokalnih podataka:
1. **34b čisto:** `src/core/gamification/rank.ts` — rang E→S iz broja „dobrih tjedana“ (zaključen tjedan s ≥ 4 konačna rezultata koji nije slabiji od prethodnog ili je prosjekom ≥ 70); rang nikad ne pada (bez kazni). `stats.ts` — Disciplina / Volja / Energija 0–100 iz dijelova konačnog rezultata (plan / zabrane / san) zadnjih 30 dana. Testovi.
2. **34b podaci:** `ScoredDay` dobiva neobavezne `parts`; `listDayScores` ih samo prosljeđuje (čitanje, bez migracije) → `HIGH_RISK: da`.
3. **34b UI:** kartica „Rang“ na Profilu — medaljon ranga (svjetlina žara raste s rangom), poruka „[Sustav]“, koraci do sljedećeg ranga, trake statova; Zdravlje i Novac prigušeni dok trackeri (31b) ne postoje. HR/EN, a11y oznake. Jedno čitanje podataka dijele „Rang“ i „Zadnjih 30 dana“.
4. **35 dio (bez haptike):** „+N XP“ iskoči uz XP traku na Danu kad XP naraste dok je ekran otvoren; poštuje „smanji kretanje“. Haptika ostaje Ž11 (čeka `expo-haptics`).
- Provjera protiv koncepta: rang „raste kad napredak traje tjednima“, statovi „iz stvarnog ponašanja“, bez broja razine (P35), žar/rang samo iz **konačnih** rezultata (P43). Pragovi ranga nisu u konceptu → pitanje 76 (ne blokira).

## 2026-11-13 · Sesija 15:43 — plan

Plan sesije (korak 20–22, grupe 2–4 koraka):
1. `tsconfig.json`: isključi `supabase/**` (Deno runtime — TS kompilator ih ne razumije)
2. **Korak 20 (LLM provider):** `supabase/functions/_shared/cors.ts` + `llm-provider.ts` (interface `LLMProvider` + Claude implementacija + logger u `llm_calls`)
3. **Korak 21 (parse-input):** `supabase/functions/parse-input/index.ts` + `src/core/schedule/edge-types.ts` (TS tipovi za app stranu)
4. **Korak 22 (plan-day):** `supabase/functions/plan-day/index.ts` (scaffold s fallback pravilima; korisnik odobrava plan)
- Edge Functions se ne mogu deployati ovdje (nema Expo ni remote Supabase ključeva); kod se piše i provjerava `tsc`-om za tipove u `src/core/`; testovi za čistu logiku. Deployment čeka Bornu.
- API ključ (`ANTHROPIC_API_KEY`) ide samo u Supabase secrets — BORNA_DECISION_NEEDED za deployment.

## 2026-11-13 · Sesija 12:43 — Ž9, Ž10, Ž12 spojeni (PR #11 `fe51250`, #12 `b74df90`, #13 `d25805f`)
- Spojeno (svaki korak zaseban commit, s testovima):
  1. **Ž9 Paljenje žara.** Žar današnjeg dana stoji uz broj rezultata u zaglavlju Dana: ugašen obrub dok dan traje, a kad večernji upit da konačni rezultat upali se na svoju razinu uz jednokratnu animaciju (aureola nabuja i smiri se, žar malo naraste i vrati se). Čisto: `todayEmber` (pali **samo konačni rezultat**, pravilo P43 — rezultat „u tijeku“ i istaknuti jučerašnji ostavljaju žar ugašen) i `shouldIgnite` (prvo crtanje i gašenje ne animiraju); tokeni `IGNITE_DURATION_MS` / `IGNITE_SWELL_MS`; `EmberIgnite` poštuje „smanji kretanje“.
  2. **Ž10 Godina → dodir mjeseca.** Redak mjeseca u Godini otvara taj mjesec u tabu Mjesec, „Ovaj mjesec“ vraća na tekući; budući mjesec nije dodirljiv. Čisto: `isMonthOpenable` i `monthHeader` (pilula „još N dana“ / „završen“). Odabir stoji u `src/features/ember/selected-month.ts` (`useSyncExternalStore`, uzorak zahtjeva obavijesti), jer su tabovi odvojeni ekrani. Prazan prošli mjesec ima svoju poruku.
  3. **Ž12 Arhiva dijagnoza** (PR #13, visokorizično): prošle dnevne dijagnoze na Profilu po mjesecima, najnovija prvo; dodir otvara dijagnozu tog dana, „Prikaži još“ dodaje deset, nepročitane nose točku. `listDayReportArchive` je **samo čitanje** (bez migracije, bez pisanja, popis ne generira dijagnozu). Čisto: `archiveByMonth`, `archiveLimit`, `archivePage`.
- Uz Ž10 je ispravljena visina dodira retka mjeseca u Godini: bila je 14 px, sad 44 px (`minHeight`), pa je grid godine zračniji.
- Namjerno izvan opsega: listanje prošlih razdoblja strelicama (korak 34b).
- Redoslijed „Žar“ (Ž1–Ž12) je sada u `BUILD_PLAN.md`, sa zasebnom numeracijom i vezama na dijelove koraka 35 i 37c.
- **Na uređaju neprovjereno** (cloud sesija nema simulator).
- Prije toga u istoj sesiji: PR #10 (`6befc61`) — pravila „samostalan rad“ u `CLAUDE.md` i novi prompt u `docs/AUTOMATION.md`; planirani zadatak je ažuriran istim promptom.
- **Zapreke iz ove sesije:**
  - GitHub credential servis i API su oko 13:05–13:15 UTC vraćali 503; push je prošao nakon ponavljanja. Ništa nije izgubljeno.
  - `npx expo install --check` ne prolazi u cloud sandboxu: proxy vraća `HTTP Proxy Network Error: Forbidden` za Expo API. Zato je taj check u objavama `NOT RUN` — i zato **Ž11 (haptika) ne može ovdje**, jer `expo-haptics` treba `npx expo install`.

## 2026-11-13 · Samostalan rad (odluka Borna, 2026-11-13 chat; isto poslano Codexu)
- Codex zaustavlja Claudea samo kod P0/P1 greške koja mijenja sve; inače Claude radi sam i sam spaja PR na zelenom CI-ju, Codex pregledava usporedno. P2/P3 idu u sljedeći PR. Pravila u `CLAUDE.md` ("samostalan rad") i prompt u `docs/AUTOMATION.md` prepisani; stara pravila čekanja i `REPOST` mehanizmi više ne vrijede.
- Bez Borne i dalje ne ide: remote Supabase migracije, tajne, promjene koncepta, brisanje.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19 gotovi + popravci retrospektivnog audita (PR #3: auth samo PKCE kod, sync vezan uz prvi račun, `seenAt` sinkroniziran, skripta radi na Bash 3.2).
- Remote Supabase `ritam`: svih 7 migracija primijenjeno (zadnja `20261111103947_sync`), advisori čisti, tablice prazne.
- Auth/sync su iza flaga `EXPO_PUBLIC_FEATURE_AUTH` (zadano isključeno).
- Na uređaju još neprovjereno: magic link / kod, sync s dva uređaja, Gotovo/Odgodi s ugašenim appom.

## Sljedeće
1. **Ž11 haptika + XP/level-up animacije** (dio koraka 35) — **čeka Bornu:** traži `expo-haptics`, a `npx expo install` u cloud sandboxu ne prolazi (proxy blokira Expo API); paket se po `AGENTS.md` ne dodaje ručno. Dovoljan je jedan `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json`.
2. Smjer „Žar“ je time odrađen do Ž10 i Ž12 (Ž1–Ž10, Ž12 su `[x]` u `BUILD_PLAN.md`). Dok Ž11 čeka, sljedeća sesija može na skupinu **20–22**, pa 23. Korak 20 = LLM provider (Edge Function `llm-provider`, Claude sada, sučelje za DeepSeek, logiranje u `llm_calls`; ključevi samo u Supabase secrets — API se naplaćuje zasebno od pretplate).
3. Na uređaju neprovjereno iz cijelog smjera „Žar“: sve je crtano bez simulatora. Kad Borna bude za Macom, vrijedi proći Dan → Tjedan → Mjesec → Godina → Profil i prijaviti što ne sjeda.

## Pitanja za Bornu
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
