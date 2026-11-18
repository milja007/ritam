# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-18 · Sesija 09:43 — korak 25: tjedni zadaci s pitanjima
1. Podaci (PR A, HIGH_RISK): domena `task.ts` — tjedni zadatak: tjedan (ponedjeljak), naslov 1–120, trajanje 5–480 min, koliko puta 1–7, rok (dan unutar tjedna ili bez), doba dana (bilo kad/jutro/popodne/večer), energija (niska/srednja/visoka), što treba (≤ 300). Najviše 10 po tjednu.
2. SQLite `tasks` (0013 + okidači synca), Supabase migracija (CHECK-ovi, RLS, tombstone; remote = Borna, pitanje 84), sync tablice, repo list/create/update/delete; testovi + `test:supabase`.
3. Core smještanje (PR B): `placeWeekTasks` — lokalno i deterministički (LLM = korak 26): samo dani od danas do roka, svaki put drugi dan, slobodni prozori (buđenje + 30 min → krevet, bez preklapanja), doba dana tvrdo, visoka energija ranije u danu, niska kasnije; već smješteni blokovi zadatka (`task_id`) se broje. Vraća prijedlog + što nije stalo i zašto. Testovi.
4. UI (PR B): kartica „Zadaci tjedna“ na Tjednu — dodavanje uz pitanja (čipovi, bez tipkanja osim naslova i „što treba“), napredak „N od M puta“ (odrađeni blokovi zadatka), „Smjesti u tjedan“ → prijedlog → Prihvati stvara blokove vrste Zadatak s `task_id` (korisnik odobrava), ukloni zadatak. HR/EN, 44 pt, labeli.
- Recenzija: koncept („pitanja kod unosa … LLM ih smješta, pravila su tvrda ograničenja“) — pravila iz pitanja su tvrda u lokalnom smještanju, LLM ostaje za 26; bez XP-a za sam zadatak (XP ide kroz blokove kao i sada). „Najviše 10“ nije u konceptu → konstanta.

## 2026-11-18 · Sesija 06:43 — korak 25 (dio)
- Gotovo: Tjedan kao kalendar + sljedeći tjedan (PR #37), ciljevi razdoblja — podaci `goals` 0012 + Supabase (PR #38, remote = Borna, pitanje 84), kartica ciljeva na Tjednu/Mjesecu/Godini (PR #39), tipkovnica (PR #40).

## Odluke (Borna, 2026-11-15) — 79 Skia da (paket na Macu), 81 tema s računom, 82 tjedna uz dnevnu + obavijest, 83 mjesečna kao smjer. Detalji u arhivi.

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

## Stanje
- `main`: korak 25 dio (Tjedan kao kalendar, ciljevi razdoblja), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-17 15:45): nema P0/P1 ni otvorenih P2 (PR #22 → #26, PR #16 → #27; model: pitanje 77).

## Sljedeće
0. **Odluka 81** — kod spojen (PR #25); ostaje remote migracija (pitanje 84) — **ne uključivati `EXPO_PUBLIC_FEATURE_AUTH` prije primjene**.
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): okviri avatara / animacije „Gotovo“ kao otključavanja (pitanje 80); **34** epski questovi i freeze tokeni (traže lokalnu tablicu + sync → remote migracija = Borna).
3. 20–22 su u appu (čekaju deploy, pitanje 77). Sada korak 25: ciljevi tjedna (podaci pa kartica), zatim tjedni zadaci s pitanjima.

## Pitanja za Bornu
87. **San (29)** — pragovi nisu u konceptu, odabrano: kratka noć = barem 1 h manje od cilja, jako kratka = 2 h; „Lakše jutro“ samo predlaže (otvara „Nešto je iskrslo“ s razlogom „Loš san“, 1 h), ne mijenja plan samo. Krevet: ako zadnjih noći (≥ 3) kasniš > 15 min, večerašnji cilj je ~15 min ranije od navike, korak po korak do cilja. Želiš li da i **wind-down obavijest** prati taj korak (umjesto ciljanog kreveta)?
85. **Žeravica (freeze tokeni, korak 34)** — pravila nisu u konceptu, odabrano: 1 žeravica za svakih 7 dana zaredom, najviše 2, troši se automatski za propušten dan (dan ne povećava niz); ako rupa ima više dana nego žeravica, niz pukne, a žeravice ostaju. Vrijedi za glavni niz svugdje (Profil, Dan, bedževi, orb, dijagnoze). Naziv u UI-ju „Žeravica“ / „Banked ember“. U redu? Promjena je jedna konstanta.
84. **Remote migracije `color_theme` (odluka 81), `quests` (korak 34), `goals` i `tasks` (korak 25)** — Claudeov alat ne smije primijeniti. Na Macu: `npx supabase db push` (primijeni `20261117010000_color_theme.sql`, `20261117180000_quests.sql`, `20261118060000_goals.sql` i `20261118100000_tasks.sql`). Dok nisu primijenjene, sync ne smije biti uključen.
86. **Epski questovi (34)** — pravila nisu u konceptu, odabrano: quest = naslov, zašto, okvirni rok (neobavezan), do 12 etapa; najviše 3 u tijeku; XP 15 po etapi i 100 za ostvaren quest (bez kazni; poništena etapa vraća XP); arhiva čuva XP. U redu?
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): ključ je već u secrets (2026-11-09), model je tvoja odluka od 2026-11-09 i sada je u kodu (`parse-input` Haiku 5.5, `plan-day` Sonnet 5.5). Ostaje samo na Macu: `npx supabase functions deploy parse-input` i `plan-day` — kad uključiš oblak.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
