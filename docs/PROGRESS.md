# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-17 · Sesija 12:43 — P2 za Edge Functions (PR #16), grana `fix/edge-p2`
- `supabase/functions/_shared/plan-logic.ts` (čisto, bez Denoa; Jest `src/core/schedule/plan-logic.test.ts`): validacija `plan-day` (svaki prioritet/prozor, 99:99, `[null]` → 400) i `parse-input` (`null` → 400); fallback: fiksni blokovi rezerviraju vrijeme (`kind: 'fixed'`), predug zadatak ne troši prozore; model: blok izvan prozora, preklapanje, pomaknut fiksni → lokalni raspored.
- `llm-provider`: upis u `llm_calls` kroz `EdgeRuntime.waitUntil` (inače `await`), greška inserta se logira; model iz `LLM_MODEL` (zadano i dalje `claude-sonnet-4-5`, povlači se 30. 11. — pitanje 77).
- `deno check` PASS (lokalni stub za `esm.sh` jer proxy blokira). Funkcije i dalje nedeployane.

## 2026-11-17 · Sesija 12:43 — koraci 37 (dopuna) i 37b, P2 (PR #26)
- **P2 (PR #22)**: `monthChanges` razlikuje konkretne ideje (ključ + JSON prve ideje); ista ideja i prenesena promjena (`carried`, i preko granice mjeseca) broje se jednom.
- **37**: zadnji dan mjeseca mjesečna dijagnoza odmah ispod dnevne (`PeriodDiagnosesInline` = tjedan + mjesec + godina; kraj večernjeg upita i `DiagnosisModal`). Bez obavijesti.
- **37b**: `local-year-v1` + `generateYearReport` (prije 31. 12. ne čita bazu) + kartica na tabu Godina (u siječnju i prošla godina) + modal s trakom 12 žarova (pale se redom, poštuje „smanji kretanje“) + 31. 12. ispod dnevne. HR/EN.
- Nije rađeno: koncept kaže da je zadnjeg dana mjeseca (ako nije nedjelja) tjedni dio „zadnjih 7 dana“ — nije napravljeno (tjedna je vezana uz pon–ned).

## Odluke (Borna, 2026-11-15) — 79 Skia da (paket na Macu), 81 tema s računom, 82 tjedna uz dnevnu + obavijest, 83 mjesečna kao smjer. Detalji u arhivi.

## 2026-11-13 · Smjer „Žar“ (odluka Borna 2026-11-12)
- „Dan izgori u žar“ ima prednost do 2026-11-17, prije koraka 20–22. Platno: https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu
- **Puni redoslijed i stanje Ž1–Ž12 su u `docs/BUILD_PLAN.md`** (sekcija „Smjer Žar“); detalji starijih skupina u arhivi. Ž1–Ž10 i Ž12 gotovi, ostaje samo Ž11.
- Sve na lokalnim podacima; žar pali samo konačni rezultat.

## Stanje
- `main`: koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-17 12:45): nema P0/P1; P2 za PR #22 riješen u PR-u #26, P2 za PR #16 u `fix/edge-p2` (model: pitanje 77).

## Sljedeće
0. **Odluka 81** — kod spojen (PR #25); ostaje remote migracija (pitanje 84) — **ne uključivati `EXPO_PUBLIC_FEATURE_AUTH` prije primjene**.
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): okviri avatara / animacije „Gotovo“ kao otključavanja (pitanje 80); **34** epski questovi i freeze tokeni (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (P2 nalazi Codexa, testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
84. **Remote migracija `color_theme` (odluka 81)** — odobrena, ali je Claudeov alat odbio primjenu. Primijeni na Macu: `npx supabase db push` (ili SQL iz `supabase/migrations/20261117010000_color_theme.sql` u SQL editoru, pa `supabase migration repair --status applied 20261117010000`). Dok nije primijenjena, sync ne smije biti uključen.
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): `supabase secrets set ANTHROPIC_API_KEY` **i `LLM_MODEL`** (zadani `claude-sonnet-4-5` se povlači 30. 11. 2026. — koji model želiš?), pa `supabase functions deploy parse-input` i `plan-day`.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
