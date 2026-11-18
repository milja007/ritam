# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-18 · Sesija 06:43 — korak 25 (dio): tjedan kao kalendar za planiranje, PR (ova grana)
1. Core `weekNav` / `isWeekOpenable` dobiju `ahead` (tjedni unaprijed): Tjedan lista **i sljedeći tjedan** (planiranje nedjeljom, P54); dalje ne. `weekDaysLeft` = dani tjedna od danas (tekući: „ostalo je N dana“, sljedeći: 7, prošli: 0). Testovi.
2. Tjedan: dodir dana koji tek dolazi (sutra i dalje, i u sljedećem tjednu) otvara isti tok kao „Što imaš sutra?“ za taj dan (naslov „Što imaš u {dan}?“); danas vodi na Dan; prošli dani ostaju samo za čitanje. Pilula „Ostalo je N dana“. Pristupačnost (gumb, hint), HR/EN.
3. Ciljevi tjedna — podaci (sljedeći PR, HIGH_RISK): tablica `goals` (razdoblje week/month/year + početak, naslov, gotovo) da je koriste i 25b; lokalna + Supabase migracija (remote = Borna), sync.
4. Ciljevi tjedna — kartica na Tjednu (do 5, dodaj/označi/obriši), bez XP-a (koncept ga ne traži).
5. Tjedni zadaci s pitanjima (trajanje, rok, koliko puta, doba dana, energija) + smještanje → kasnije (26).
- Ne radi se: wind-down po koraku kreveta (čeka pitanje 87).

## Odluke (Borna, 2026-11-15) — 79 Skia da (paket na Macu), 81 tema s računom, 82 tjedna uz dnevnu + obavijest, 83 mjesečna kao smjer. Detalji u arhivi.

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

## Stanje
- `main`: koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-17 15:45): nema P0/P1 ni otvorenih P2 (PR #22 → #26, PR #16 → #27; model: pitanje 77).

## Sljedeće
0. **Odluka 81** — kod spojen (PR #25); ostaje remote migracija (pitanje 84) — **ne uključivati `EXPO_PUBLIC_FEATURE_AUTH` prije primjene**.
1. **Ž11 haptika** — čeka Bornu: `npx expo install expo-haptics` na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API). Isto vrijedi za Skiu (korak 33).
2. UX/UI dok traje prioritet (do 2026-11-17): okviri avatara / animacije „Gotovo“ kao otključavanja (pitanje 80); **34** epski questovi i freeze tokeni (traže lokalnu tablicu + sync → remote migracija = Borna).
3. Dovršiti 20–22 (P2 nalazi Codexa, testovi, spajanje na korak 13), pa 23.

## Pitanja za Bornu
87. **San (29)** — pragovi nisu u konceptu, odabrano: kratka noć = barem 1 h manje od cilja, jako kratka = 2 h; „Lakše jutro“ samo predlaže (otvara „Nešto je iskrslo“ s razlogom „Loš san“, 1 h), ne mijenja plan samo. Krevet: ako zadnjih noći (≥ 3) kasniš > 15 min, večerašnji cilj je ~15 min ranije od navike, korak po korak do cilja. Želiš li da i **wind-down obavijest** prati taj korak (umjesto ciljanog kreveta)?
85. **Žeravica (freeze tokeni, korak 34)** — pravila nisu u konceptu, odabrano: 1 žeravica za svakih 7 dana zaredom, najviše 2, troši se automatski za propušten dan (dan ne povećava niz); ako rupa ima više dana nego žeravica, niz pukne, a žeravice ostaju. Vrijedi za glavni niz svugdje (Profil, Dan, bedževi, orb, dijagnoze). Naziv u UI-ju „Žeravica“ / „Banked ember“. U redu? Promjena je jedna konstanta.
84. **Remote migracije `color_theme` (odluka 81) i `quests` (korak 34)** — Claudeov alat ne smije primijeniti. Na Macu: `npx supabase db push` (primijeni `20261117010000_color_theme.sql` i `20261117180000_quests.sql`). Dok nisu primijenjene, sync ne smije biti uključen.
86. **Epski questovi (34)** — pravila nisu u konceptu, odabrano: quest = naslov, zašto, okvirni rok (neobavezan), do 12 etapa; najviše 3 u tijeku; XP 15 po etapi i 100 za ostvaren quest (bez kazni; poništena etapa vraća XP); arhiva čuva XP. U redu?
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): ključ je već u secrets (2026-11-09), model je tvoja odluka od 2026-11-09 i sada je u kodu (`parse-input` Haiku 5.5, `plan-day` Sonnet 5.5). Ostaje samo na Macu: `npx supabase functions deploy parse-input` i `plan-day` — kad uključiš oblak.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
