# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-19 · Sesija 00:43 — Ž11 haptika, zatim 33 orb-plamen na Skii
- Paketi su stigli (PR #56: `expo-haptics`, Skia), pa se rade dva zadnja „Žar“ dijela koja su ih čekala.
- Plan Ž11 (PR 1): (1) `src/core/haptics` — čista logika: događaj → vrsta (`done`, `skip`, `streak`, `achievement`, `levelUp`, `tick`), spajanje događaja u istom trenutku (jači pobjeđuje, isti se ne ponavlja), vremenska crta haptike level-upa (tik po broju razine, uspjeh na prasku); testovi. (2) `src/ui/haptics.ts` — `playHaptic` preko `expo-haptics` (greška nikad ne ruši ekran, bez weba), uključeno po defaultu, prekidač „Haptika“ na Profilu (postavka uređaja, bez migracije), HR/EN. (3) Spojiti: Gotovo / Preskoči na Danu, bljesak niza, smrzavanje, quest/cilj ostvaren, level-up.
- Gotovo (PR #59): 1–3; Ž11 i 35 `[x]`. Akcija „Gotovo“ na obavijesti ostaje bez haptike (app u pozadini, iOS je ne svira).
- Plan 33 (PR 2): pravi plamen na Skii u `OrbFlame` (jezici plamena iz šuma koji se dižu, čestice iz niza), iste boje i pravila iz `src/core/gamification/orb.ts`; uz „smanji kretanje“ miran; stari prikaz ostaje za web.

## Odluke Borne (anketa u chatu, 2026-11-18 ~22:00)
- 89/91 (dijagnoze riječima): **u redu** — model piše tekst, promjenu/smjer bira app, samo svjež period.
- 90 (trackeri): u redu, **plus prihodi** — praćenje prihoda kao opcija, **isključeno po defaultu** (uključuje se u Profilu). → novi korak 31f.
- 85 (žeravica), 76 (rang), 75 (drugi račun ostaje blokiran), 78 (bedževi): **u redu, ostaje**.
- 86 (questovi): **„samo badge“** — tumačenje: ostvaren quest daje bedž, **bez XP-a** za etape i quest. → korak 34c.
- 80 (otključavanja): **dodati okvire avatara i animacije „Gotovo“** kao nagrade po razini. → korak 32b.
- Modeli (korak 40): **bez DeepSeeka**; „najjeftiniji, ali dobar za ovo“ → `parse-input` i `plan-day` Haiku 5.5, `write-report` Sonnet 5.5. `plan-day` treba ponovni deploy.
- 88 (zabrane) i 87 (wind-down po koraku): bez odgovora → ostaje kako je; wind-down i dalje prati ciljani krevet.

## 2026-11-18 · Sesija 21:43 — korak 31e: godišnja dijagnoza riječima
- Plan (isti obrazac kao 31c/31d; koncept: godišnja = dan + tjedan + mjesec + godina, smjer najviše 2 ideje):
  (1) `write-report` godišnji način (`llm-year-v1`): statistika godine i prošle (s trackerima), prosjek po mjesecima (12), sažeci mjesečnih dijagnoza te godine (bez 365 dana — previše), lokalni smjer, tjedne promjene godine, do 2 ranije godišnje s Pomoglo/Nije. Granice brojeva skaliraju s duljinom razdoblja (godina ima > 5000 blokova). Model piše riječi + jednu rečenicu uz smjer; smjer ne mijenja.
  (2) App: `sections.llm` uz godišnju (otpada kad se statistika ili smjer promijene), poziv samo za svježu godinu (31. 12. ili 1. 1.), bez oblaka lokalna; kartica Godine koristi `llm.summary`.
- Pitanje 91 vrijedi i za godinu.
- Gotovo (PR #54): 1–2. Korak 31e `[~]` do deploya (pitanje 77). Dijagnoze dan/tjedan/mjesec/godina sada sve imaju riječi modela (s oblakom).

## 2026-11-18 · Sesija 18:43 — koraci 31c (PR #52) i 31d (PR #53): tjedna i mjesečna dijagnoza riječima; `[~]` do deploya.

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-18 09:45): nema Codexovih zahtjeva od 2026-11-17 15:45; nema P0/P1 ni otvorenih P2.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. **33 Skia orb-plamen** (paket stigao u PR #56; Ž11 haptika gotova u PR #59). Za oboje treba novi development build na iPhoneu.
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 30 (glasovni unos — novi paket), 24 (Google Calendar — OAuth tajne).
3. **Sljedeće skupine (Bornine odluke 2026-11-18):** 34c questovi samo s bedžem (bez XP-a); 31f prihodi kao opcijski tracker (isključen po defaultu; lokalna migracija + Supabase migracija = HIGH_RISK, remote primjenjuje Borna); 32b okviri avatara i animacije „Gotovo“ kao nagrade po razini. Uz to P2 nalazi Codexa kad stignu.

## Pitanja za Bornu
84. **Remote migracije** (`color_theme`, `quests`, `goals`, `tasks`, `rule_periods`, `trackers`) — Claudeov alat ne smije primijeniti. Na Macu `npx supabase db push`. Dok nisu primijenjene, sync ne smije biti uključen.
77. ~~Deploy Edge Functions~~ — **deployano 2026-11-18 (Codex)**. Nakon PR-a s modelom `plan-day` treba ponovo deployati (`npx supabase functions deploy plan-day`). Živi probni poziv čeka prijavljenog korisnika (migracije, pitanje 84).
- Pitanja 75–91 odgovorena 2026-11-18 (gore, „Odluke Borne“); 87 i 88 bez odgovora → ostaje kako je. Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
