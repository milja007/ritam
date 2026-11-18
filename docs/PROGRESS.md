# Dnevnik napretka

Kratko, samo aktualno stanje (cilj ≤ 5 KB). Najnovije na vrhu. Stari unosi idu u `docs/PROGRESS-ARCHIVE.md` (sesije ga ne čitaju, osim `grep` za konkretan detalj).

## 2026-11-18 · Sesija 12:43 — korak 28: zabrane unutar planova
- Prioritet „Žar“ istekao 2026-11-17; 20–22 čekaju deploy (Borna), pa ide faza 2 redom: 26 traži deploy `plan-day` za provjeru → prvo 28.
- Plan (provjeren protiv koncepta „zabrane se postavljaju unutar planova godine/mjeseca/tjedna; naziv, kad vrijedi, razlog, težina 1–3; svaka ima streak i lagano Držao sam se / Prekršio“): (1) zabrana dobiva razdoblje `period` + `period_start` (oba `null` = stalna, kao zabrane iz onboardinga); lokalna migracija 0014 + Supabase migracija (remote = Borna, pitanje 84). (2) Core: `isRuleActiveOn` (dan u tjednu + unutar razdoblja), `rulesActiveOn` ga koristi → večernji upit pita samo zabrane koje taj dan vrijede; `ruleStreak` (dani zaredom kad je vrijedila i držao si se; današnji neodgovoren dan ne prekida, neodgovoren prošli prekida, dani kad ne vrijedi se preskaču) + najbolji niz. (3) Repo: `createRule` s razdobljem, `listRuleLogs`, `deleteRule` samo bez povijesti. (4) UI: kartica „Zabrane“ na Tjednu/Mjesecu/Godini — zabrane koje vrijede u tom razdoblju (i šire: godina/mjesec/stalne, s oznakom izvora), niz žarom po zabrani, dodavanje za to razdoblje (naziv, zašto, težina, dani), prošlo razdoblje samo čitanje.
- Nije u konceptu (konstante, pitanje 88): pravila niza; brisanje samo bez povijesti; najviše 5 zabrana po razdoblju.
- Gotovo: 1–3 (PR #44; remote migracija `20261118120000_rule_periods.sql` = Borna, pitanje 84).

## 2026-11-18 · Sesija 09:43 — korak 25: tjedni zadaci s pitanjima
- Plan (provjeren protiv koncepta „pitanja kod unosa … LLM ih smješta, pravila su tvrda“): (1–2) podaci `tasks` (tjedan, naslov, trajanje 5–480, koliko puta 1–7, rok u tjednu, doba dana, energija, što treba; najviše 10 — konstanta, nije u konceptu), (3) lokalno smještanje `placeWeekTasks` po tvrdim pravilima (LLM = 26), (4) kartica „Zadaci tjedna“ na Tjednu s pitanjima kao čipovima i prijedlogom koji korisnik odobrava. Bez XP-a za sam zadatak (XP ide kroz blokove).
- Gotovo: 1–2 (PR #41, remote migracija = Borna, pitanje 84), 3–4 (PR #42). Korak 25 `[x]`.
- 25b (PR #43): Mjesec kao kalendar za planiranje (sljedeći mjesec, dodir dana → plan dana, točka za dane s planom; usporedba i dijagnoza skrivene za budući mjesec); Godina otvara i sljedeći mjesec, u prosincu „Ciljevi za <sljedeću godinu>“. Korak 25b `[x]`.

## Smjer „Žar“ (odluka Borna 2026-11-12): platno https://claude.ai/artifact/A5QDrLjhMNdLvGS1jQT8yu; Ž1–Ž10 i Ž12 gotovi, Ž11 (haptika) čeka paket. Detalji u `BUILD_PLAN.md`.

## Stanje
- `main`: koraci 25 i 25b (kalendari tjedna/mjeseca za planiranje, ciljevi razdoblja, tjedni zadaci), koraci 0–19, 32, 34b, 36, 37 i 37b (lokalne), 37c, 38, Ž1–Ž10 i Ž12; bedževi (dio 34); orb-plamen bez Skie (dio 33); animacije bez haptike (35); kod koraka 20–22 (nedeployan).
- Remote Supabase `ritam`: 7 migracija (zadnja `20261111103947_sync`), tablice prazne. Auth/sync iza `EXPO_PUBLIC_FEATURE_AUTH` (isključeno).
- Na uređaju neprovjereno: cijeli smjer „Žar“, Profil (orb-plamen, rang, statovi, bedževi, teme), level-up, tjedna, mjesečna i godišnja dijagnoza, magic link, sync s dva uređaja.
- Stanje #1 (2026-11-18 09:45): nema Codexovih zahtjeva od 2026-11-17 15:45; nema P0/P1 ni otvorenih P2.

## Sljedeće
0. **Ne uključivati `EXPO_PUBLIC_FEATURE_AUTH`** dok remote migracije nisu primijenjene (pitanje 84).
1. **Ž11 haptika / Skia (33)** — čeka Bornu: `npx expo install expo-haptics` (i Skia) na Macu + commit `package.json` / `package-lock.json` (cloud proxy blokira Expo API).
2. 20–22 su u appu (čekaju deploy, pitanje 77). Dalje: 26 (zadaci i ciljevi u `plan-day`), 28 (zabrane unutar planova).

## Pitanja za Bornu
88. **Zabrane u planovima (28)** — nije u konceptu, odabrano: zabrana pripada tjednu, mjesecu ili godini (zabrane iz onboardinga su „stalne“); u tjednu se vide i zabrane mjeseca/godine/stalne; najviše 5 po razdoblju; niz = dani zaredom kad vrijedi i držao si se (dan kad ne vrijedi se preskače, prošli dan bez odgovora prekida, današnji ne); zabrana s poviješću se ne briše (povijest ulazi u rezultate). U redu?
87. **San (29)** — pragovi nisu u konceptu, odabrano: kratka noć = barem 1 h manje od cilja, jako kratka = 2 h; „Lakše jutro“ samo predlaže (otvara „Nešto je iskrslo“ s razlogom „Loš san“, 1 h), ne mijenja plan samo. Krevet: ako zadnjih noći (≥ 3) kasniš > 15 min, večerašnji cilj je ~15 min ranije od navike, korak po korak do cilja. Želiš li da i **wind-down obavijest** prati taj korak (umjesto ciljanog kreveta)?
85. **Žeravica (freeze tokeni, korak 34)** — pravila nisu u konceptu, odabrano: 1 žeravica za svakih 7 dana zaredom, najviše 2, troši se automatski za propušten dan (dan ne povećava niz); ako rupa ima više dana nego žeravica, niz pukne, a žeravice ostaju. Vrijedi za glavni niz svugdje (Profil, Dan, bedževi, orb, dijagnoze). Naziv u UI-ju „Žeravica“ / „Banked ember“. U redu? Promjena je jedna konstanta.
84. **Remote migracije `color_theme` (odluka 81), `quests` (korak 34), `goals` i `tasks` (korak 25), `rule_periods` (korak 28)** — Claudeov alat ne smije primijeniti. Na Macu: `npx supabase db push` (primijeni `20261117010000_color_theme.sql`, `20261117180000_quests.sql`, `20261118060000_goals.sql`, `20261118100000_tasks.sql` i `20261118120000_rule_periods.sql`). Dok nisu primijenjene, sync ne smije biti uključen.
86. **Epski questovi (34)** — pravila nisu u konceptu, odabrano: quest = naslov, zašto, okvirni rok (neobavezan), do 12 etapa; najviše 3 u tijeku; XP 15 po etapi i 100 za ostvaren quest (bez kazni; poništena etapa vraća XP); arhiva čuva XP. U redu?
75. Prelazak na drugi račun na istom uređaju: sync je sada blokiran (sigurno). (a) ostaje tako; (b) gumb "Obriši podatke s uređaja i preuzmi drugi račun" uz potvrdu; (c) zasebni lokalni podaci po računu.
76. Rang (34b): pragovi i definicija „dobrog tjedna“ nisu u konceptu, pa su odabrani ovdje (gore). Je li u redu da S traži 20 dobrih tjedana i da tjedan koji samo drži isti prosjek ispod 70 ne broji? Promjena je jedna konstanta.
77. Deploy Edge Functions (20–22): ključ je već u secrets (2026-11-09), model je tvoja odluka od 2026-11-09 i sada je u kodu (`parse-input` Haiku 5.5, `plan-day` Sonnet 5.5). Ostaje samo na Macu: `npx supabase functions deploy parse-input` i `plan-day` — kad uključiš oblak.
78. Bedževi (34): popis i pragovi nisu u konceptu, odabrani su ovdje (gore). „7 dana bez prekršaja“ se može osvojiti samo ako su zabrane uključene u područja rezultata. Dodati/maknuti koji? Promjena je mala.
80. Otključavanja (32): koncept navodi vrste (tema, okvir avatara, animacija, naslov), ne popis. Odabrano: 5 tema i 6 naslova na razinama 1–15 (gore). Je li raspored u redu i želiš li okvire avatara i nove animacije „Gotovo“ kao nagrade?
- Starija pitanja (23–70) su u arhivi pod "Pitanja za Bornu". Dio je možda već riješen u kodu — sljedeća sesija s viškom kvote ih može sažeti u jedan paket za anketu.
