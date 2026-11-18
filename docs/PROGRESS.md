# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-18 · Sesija 18:43 — korak 31c: tjedna dijagnoza s trackerima i riječima modela
- Plan (koncept „Dijagnoze“: LLM dobiva sve iz razdoblja — checklist i komentari, zabrane, san, XP, **trackeri**, prethodne dijagnoze; isti red sekcija; „najviše 1 nova promjena tjedno“):
  (1) Trackeri u lokalnoj tjednoj/mjesečnoj/godišnjoj dijagnozi: statistika razdoblja broji dane s unosom kalorija (unutar/iznad/ispod) i potrošnju naspram zbroja dnevnih dijelova limita; Napredak „Kalorije: dani unutar cilja“, „Potrošnja“; pohvala/uočeno. i18n HR/EN.
  (2) `write-report` tjedni način (prompt `llm-week-v1`, čista logika `_shared/week-report-logic.ts`, primjer, testovi): tjedan, dani ukratko, prošli tjedan, lokalni prijedlog tjedna, ranije tjedne dijagnoze s Pomoglo/Nije. Model piše Ukratko, Pohvale, Što smo primijetili, Velike probleme i jednu rečenicu „zašto baš ova promjena“ — **promjenu tjedna i dalje bira lokalna logika** (Probat ću / Ne sada, pauza 2 tjedna), model je ne mijenja.
  (3) App: `sections.llm` uz tjednu dijagnozu (otpada kad se statistika tjedna promijeni), poziv samo za svjež tjedan (nedjelja ili ponedjeljak; arhiva ne troši pozive), bez oblaka lokalna kao dosad. `[~]` do deploya (pitanje 77).
- Nije u konceptu (pitanje 91): pragovi pohvale/uočenog za trackere u tjednu; da model ne bira promjenu.

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

## Stanje
- `main`: korak 31b (trackeri kalorija i novca, s rezultatom i dijagnozom), korak 31 (Pomoglo/Nije pomoglo + `write-report`, nedeployan), korak 28 (zabrane u planovima s nizom), koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-18 09:45): nema Codexovih zahtjeva od 2026-11-17 15:45; nema P0/P1 ni otvorenih P2.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. **Ž11 haptika / Skia (33)** — čeka Bornu: `npx expo install expo-haptics` (i Skia) na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API).
2. 20–22, 26 i 31 su u appu (čekaju deploy `parse-input`, `plan-day`, `write-report`, pitanje 77); 31b gotov. Faza 2 što ostaje traži Bornu: 30 (glasovni unos — novi paket), 24 (Google Calendar — OAuth tajne), 29 (wind-down po koraku — pitanje 87).
3. Bez Borne sljedeće sesije mogu: tjedna/mjesečna dijagnoza s trackerima i LLM-om (proširenje `write-report` na tjedan, prompt `llm-week-v1`), P2 nalaze Codexa kad stignu, sažetak starih pitanja (23–70) u jedan paket.

## Pitanja za Bornu
90. **Trackeri (31b)** — nije u konceptu, odabrano: kalorije „unutar cilja“ = ±10 %; upozorenje kad je cilj < 1200 kcal (cilj 500–10 000 je dopušten); novac u € (centi u bazi), limit za dan/tjedan/mjesec (tjedan pon–ned), stanje = zadani iznos na dan X minus potrošnja od tog dana; potrošnja s budućim datumom se ne broji. U rezultatu: težina 15 svaki, samo dani s unosima (dan bez potrošnje koji nije zapisan ne ulazi), isključen tracker ne ulazi ni u prošle dane (za razliku od područja, nema snimke). Treba li druga valuta ili prihodi (ne samo potrošnja)?
89. **LLM dijagnoza dana (31)** — nije u konceptu, odabrano: model piše riječi (Ukratko, do 3 pohvale, do 3 uočena uzorka, do 2 velika problema, 1–2 ideje; redak ≤ 280 znakova), brojke „Napretka“ i trend ostaju lokalni; kontekst = danas, jučer, do 14 ranijih dana (komentari, prekršaji), zadnjih 5 dijagnoza s Pomoglo/Nije i komentarom; piše se samo za danas i jučer. U redu?
88. **Zabrane u planovima (28)** — nije u konceptu, odabrano: zabrana pripada tjednu, mjesecu ili godini (zabrane iz onboardinga su „stalne“); u tjednu se vide i zabrane mjeseca/godine/stalne; najviše 5 po razdoblju; niz = dani zaredom kad vrijedi i držao si se (dan kad ne vrijedi se preskače, prošli dan bez odgovora prekida, današnji ne); zabrana s poviješću se ne briše (povijest ulazi u rezultate). U redu?
87. **San (29)** — pragovi nisu u konceptu, odabrano: kratka noć = barem 1 h manje od cilja, jako kratka = 2 h; „Lakše jutro“ samo predlaže (otvara „Nešto je iskrslo“ s razlogom „Loš san“, 1 h), ne mijenja plan samo. Krevet: ako zadnjih noći (≥ 3) kasniš > 15 min, večerašnji cilj je ~15 min ranije od navike, korak po korak do cilja. Želiš li da i **wind-down obavijest** prati taj korak (umjesto ciljanog kreveta)?
85. **Žeravica (freeze tokeni, korak 34)** — pravila nisu u konceptu, odabrano: 1 žeravica za svakih 7 dana zaredom, najviše 2, troši se automatski za propušten dan (dan ne povećava niz); ako rupa ima više dana nego žeravica, niz pukne, a žeravice ostaju. Vrijedi za glavni niz svugdje (Profil, Dan, bedževi, orb, dijagnoze). Naziv u UI-ju „Žeravica“ / „Banked ember“. U redu? Promjena je jedna konstanta.
84. **Remote migracije `color_theme` (odluka 81), `quests` (korak 34), `goals` i `tasks` (korak 25), `rule_periods` (korak 28), `trackers` (korak 31b)** — Claudeov alat ne smije primijeniti. Na Macu: `npx supabase db push` (primijeni `20261117010000_color_theme.sql`, `20261117180000_quests.sql`, `20261118060000_goals.sql`, `20261118100000_tasks.sql` i `20261118120000_rule_periods.sql`, `20261118160000_trackers.sql`). Dok nisu primijenjene, sync ne smije biti uključen.
86. **Epski questovi (34)** — pravila nisu u konceptu, odabrano: quest = naslov, zašto, okvirni rok (neobavezan), do 12 etapa; najviše 3 u tijeku; XP 15 po etapi i 100 za ostvaren quest (bez kazni; poništena etapa vraća XP); arhiva čuva XP. U redu?
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22, 26, 31): ključ je već u secrets (2026-11-09), model je tvoja odluka od 2026-11-09 i sada je u kodu (`parse-input` Haiku 5.5, `plan-day` i `write-report` Sonnet 5.5). Ostaje samo na Macu: `npx supabase functions deploy parse-input`, `plan-day` i `write-report` — kad uključiš oblak. Primjeri za probu `write-report`: `supabase/functions/_shared/report-examples.ts`.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
