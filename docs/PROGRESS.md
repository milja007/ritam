# Dnevnik napretka

Najnovije na vrhu. Svaka sesija: datum · korak · što je napravljeno · što je sljedeće · problemi/odluke.

## 2026-11-10 08:43 · Korak 15 — XP traka + streak u UI-ju
**Plan (recenziran prije koda):**
1. Grana `wip/korak-15`; bez novih ovisnosti i bez migracije (sve izvedeno iz `xp_events` i `checkins`).
2. Čisto `src/core/gamification/level.ts`: krivulja iz punog koncepta (level 2 = 100 XP, svaki sljedeći korak ~15 % više, zaokruženo na 5) → `xpForLevelStep(level)`, `levelProgress(totalXp)` = { level, xpIntoLevel, xpForNext, fraction }. Samo računanje za traku — otključavanja, level-up animacija i nagrade ostaju korak 32. Testovi.
3. Čisto `progressSummary(events, checkins, today)` → { totalXp, todayXp, level…, streak } (koristi postojeće `totalXp`, `xpForDate`, `mainStreak`). Testovi.
4. Repo `listEveningCheckins(db, user)` (datum, vrsta, ocjena) — test nad Node SQLite-om.
5. `src/features/progress/`: mali store `notifyProgressChanged()` + `useProgress(today)` (učitava XP eventove i upite; osvježava se na promjenu, na vanjsku promjenu blokova i pri fokusu taba). Okidači: kvačica na timelineu, spremanje večernjeg upita i jutarnje prijave.
6. UI: **XpStreakBar** (kompaktno) na vrhu Danas — razina, traka do sljedeće razine, "+N XP danas", streak s oznakom je li današnji upit već ubrojen; **ProgressCard** na Profilu — ukupni XP, razina + traka, XP danas, trenutni i najduži streak. Bez kazni i bez crvenog: streak 0 → poticajna poruka.
7. i18n HR/EN (`progress.*`) + pristupačnost (`progressbar` s `accessibilityValue`, oznake brojeva).
8. Provjere `tsc`, `lint`, `test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = XP traka i streak na Danas (6) i Profilu (6). Traci treba cilj — koncept definira krivulju razina (level 2 = 100 XP, +15 %) i "izvedeno, ne spremljeno", pa ju koristim samo za prikaz; otključavanja i level-up su korak 32 (faza 3) i ne diram ih. Prikaz broja razine već u fazi 1 je moja odluka u izvedbi → pitanje za Bornu. Freeze tokeni (korak 34) i streakovi zabrana (28) nisu ovaj korak. Avatar/orb (33) nije ovaj korak.

**Napravljeno:**
- Bez novih ovisnosti, bez migracije.
- Čisto `src/core/gamification/level.ts`: krivulja iz koncepta — koraci 100, 115, 130, 150, 175… XP (×1,15, zaokruženo na 5); `xpForLevelStep`, `levelProgress(totalXp)` → razina, XP unutar razine, XP do sljedeće, udio trake. Samo prikaz; otključavanja i level-up su korak 32.
- Čisto `progressSummary(events, checkins, today, checkinDay)` → ukupni XP, XP danas, razina, glavni streak. Streak se računa prema **danu upita** (iza ponoći jučer), da upit ispunjen u 00:30 ne izgleda neubrojen.
- Repo `listEveningCheckins` (datum, vrsta, ocjena; samo večernji, uzlazno).
- `src/features/progress/`: `useProgress` (osvježava se na `notifyProgressChanged()`, na Gotovo iz obavijesti preko `useBlocksVersion` i pri fokusu taba — tabovi ostaju montirani); okidači u kvačici/uređivanju/brisanju bloka, spremanju večernjeg upita i jutarnje prijave.
- **XpStreakBar** na vrhu Danas: "Razina N", "Niz: N", traka, "+N XP danas", "X / Y XP do razine N+1", poticajna poruka (ubrojeno / ispuni upit / upit pokreće novi niz — bez kazni i bez crvenog).
- **ProgressCard** na Profilu (sekcija "Napredak"): razina + ukupni XP, veća traka, tri broja (XP danas, Dani zaredom, Najduži niz), ista poruka; brojevi formatirani po jeziku.
- `src/ui/progress-bar.tsx` (statična traka, `accessibilityRole="progressbar"` s vrijednošću). i18n HR/EN (`progress.*`, `profile.progress`) bez plural oblika ("Niz: 5", "Dani zaredom").
- 12 novih testova (ukupno 403). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (403/403), `expo export --platform android` ✅ (4.5 MB).

**Problemi/napomene:**
- Nije isprobano na uređaju (sandbox): izgled trake, osvježavanje pri prelasku na Profil.
- Traka je statična; animacija punjenja i level-up su koraci 32/35. Freeze tokeni (34) još ne utječu na streak.
- Odluka u izvedbi: broj razine se prikazuje već sada (koncept stavlja levele u fazu 3) — traci treba cilj, a krivulja je iz koncepta.

**Pitanja za Bornu:**
35. XP traka pokazuje napredak do sljedeće razine ("Razina 3", krivulja iz koncepta: 100 XP, pa +15 % po razini). Odgovara li da se razina vidi već u fazi 1, ili želiš traku bez broja razine dok ne dođu otključavanja (korak 32)?
36. Streak se zove "Niz" u HR UI-ju ("Niz: 5", "Dani zaredom"). Želiš li ostaviti engleski "streak" i u hrvatskom?

**Sljedeće:** korak 16 — dnevna dijagnoza (lokalna): na kraju upita struktura dijagnoze (Ukratko, Napredak, Pohvale…) iz statistike dana i usporedbe s jučer, spremanje u `reports`.

## 2026-11-10 06:43 · Korak 14 — Jutarnji brief
**Plan (recenziran prije koda):**
1. Grana `wip/korak-14`; bez novih ovisnosti i bez migracije (`checkins` već ima `kind: morning`, `sleepStart`, `wakeTime`; jedinstveni indeks jedan jutarnji po danu).
2. Čisto u `src/core/checkin/morning.ts`: `createMorningDraft(settings, date, saved)` (prijava sna unaprijed popunjena: zaspao = ciljani krevet prethodne večeri, probudio = buđenje tog dana — "dva taba": po potrebi pomakni, pa Spremi); `sleepDurationMinutes` (preko ponoći); `isMorningDraftValid`; `morningXpAwards` (krevet ±30 min od cilja → 20 XP, postojeći `xpForBedtime`; buđenje bez snooze se ne može znati → ne dodjeljuje se); `greetingFor(minutes)` (jutro / dan / večer); `briefSummary(blocks, nowMinutes)` (broj blokova bez sna, broj zadataka, prvi sljedeći blok). Testovi.
3. Repo `getMorningCheckin` / `saveMorningCheckin` (jedna sinkrona transakcija: upsert jutarnjeg checkina, XP sna zamijeni se pri ponovnom spremanju, `mood` ostaje `null` — raspoloženje se ne prati). Testovi nad Node SQLite-om.
4. Otvaranje: dodir jutarnje obavijesti → `requestMorningBrief()` (isti mehanizam kao večernji upit); na Danas i kartica "Jutarnji brief" dok jutarnja prijava nije spremljena (da se brief može otvoriti i bez obavijesti).
5. UI `src/features/morning/`: modal — pozdrav + sat i datum; prijava sna (Zaspao / Probudio `ClockStepper`, trajanje sna, Spremi → +XP; spremljeno → prikaz + Uredi); raspored dana kao vodoravne kartice koje se listaju (vrijeme, naziv, vrsta, "2/5"; prazno → poruka); gumbi **Prilagodi** (zatvori brief → timeline Danas za uređivanje) i **Kreni** (kratki fade "Dan počinje", pa zatvori; prava animacija je korak 35).
6. i18n HR/EN + pristupačnost (oznake steppera, kartica, live region za XP).
7. Provjere `tsc`, `lint`, `test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = ekran iz notifikacije (4), pozdrav (2, 5), prijava sna u dva taba (2, 3, 5), kartice dana (5), Prilagodi / Kreni (5). Puni koncept prijave ima i "Kako se osjećaš 1–5?", ali Borna je 2026-11-09 odlučio da se **raspoloženje ne prati** → izostavljeno. Prilagodba rasporeda lošem snu je korak 29, izbor sadržaja jutarnje obavijesti (broj blokova, streak…) u postavkama nije ovaj korak — tekst obavijesti ostaje općenit (pitanje). XP za krevet na vrijeme je iz tablice koncepta (nije nova odluka). Kartica na Danas je ulaz za testiranje bez obavijesti — kad se skriva, pitanje za Bornu.

**Napravljeno:**
- Bez novih ovisnosti, bez migracije (jutarnji checkin već postoji u shemi, jedan po danu).
- Čisto `src/core/checkin/morning.ts`: `targetBedtimeFor` (krevet prethodne večeri prema buđenju tog dana, vikendom vikend), `createMorningDraft` (prijava unaprijed popunjena iz ciljeva ili spremljene prijave), `sleepDurationMinutes` (preko ponoći), `isMorningDraftValid`, `morningXpAwards` (krevet ±30 min od cilja → 20 XP; bez kazne), `greetingFor` (04–12 jutro, 12–18 dan, inače večer), `briefBlocks` / `briefSummary` / `briefStartIndex` (blokovi bez sna, broj blokova i zadataka, prvi neriješeni trenutni/sljedeći blok).
- Repo `getMorningCheckin` / `saveMorningCheckin` (jedna transakcija; ponovno spremanje ažurira isti red i zamjenjuje XP sna; `mood` ostaje `null`). Jutarnja prijava ne utječe na glavni streak.
- Dodir jutarnje obavijesti → `requestMorningBrief()` → brief se otvori na Danas čim su podaci učitani.
- `src/features/morning/`: **MorningBrief** (modal) — pozdrav prema dobu dana + vrijeme i datum, sažetak ("Blokova danas: 4 · zadataka: 2. Prvi: Posao u 09:00."), **prijava sna** (Zaspao / Probudio, trajanje, Spremi → +XP; spremljeno → sažetak + Uredi), **kartice dana** (vodoravno listanje sa snapom, od trenutnog/sljedećeg bloka, "2/5", točkice, prazno stanje), **Prilagodi** (zatvori → timeline Danas) i **Kreni** (kratki fade "Dan počinje", poštuje "smanji pokrete", pa zatvori). **MorningCard** na Danas dok san nije prijavljen.
- i18n HR/EN (`morning.*`), pristupačnost (oznake kartica "1 od 5…", live region za XP, hint za Prilagodi).
- 25 novih testova (ukupno 391). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (391/391), `expo export --platform android` ✅ (4.5 MB).

**Problemi/napomene:**
- Nije isprobano na uređaju (sandbox): listanje kartica i početna pozicija, fade "Dan počinje", otvaranje iz obavijesti.
- Raspoloženje se ne pita (odluka 2026-11-09), iako ga puni koncept spominje u jutarnjoj prijavi.
- "Buđenje bez snooze" (+10 XP iz tablice) app ne može znati → ne dodjeljuje se.
- Tekst jutarnje obavijesti je i dalje općenit; izbor sadržaja (broj blokova, prvi blok, streak) u postavkama nije bio dio koraka.
- Prilagodba rasporeda lošem snu je korak 29; prava animacija "Dan počinje" korak 35.

**Pitanja za Bornu:**
32. Kartica "Jutarnji brief" na Danas vidi se cijeli dan dok san nije prijavljen. Želiš li da nestane nakon podneva (ili nakon nekog sata), ili da ostane?
33. Treba li jutarnja obavijest već sada nositi sadržaj dana ("Danas 4 bloka i 2 zadatka. Prvi: posao u 9:00.") — to je dio "biraš što sadrži" iz koncepta; mogu to dodati kao mali korak (bez postavki, fiksan sadržaj)?
34. XP za krevet na vrijeme (20) se dodjeljuje kroz jutarnju prijavu (zaspao unutar ±30 min od cilja). Odgovara li?

**Sljedeće:** korak 15 — XP traka + streak u UI-ju (Danas i Profil).

## 2026-11-10 00:43 · Korak 13c — Postavke i onboarding: dorade
**Plan (recenziran prije koda):**
1. Grana `wip/korak-13c`. Migracija `0002_settings_refinements`: `settings` + `weekend_wake_time` (NULL = isto kao radni dan), `morning_notif_enabled` / `evening_notif_enabled` / `wind_down_notif_enabled` (default 1); `language` smije biti `system`. Zod shema i Drizzle prate; test migracije nad Node SQLite-om.
2. Čisto (`src/core/schedule/wake.ts` ili `onboarding`): `isWeekend(date)` (sub/ned), `wakeTimeFor(settings, date)`, `bedtimeBefore(settings, date)` (krevet večer prije dana = buđenje tog dana − sati sna), `weekendWakeWarning` (razlika > 60 min, preko ponoći ispravno). Testovi.
3. Okidači: horizont **7 dana** (`DEFAULT_SCHEDULE_DAYS = 7`, 7 × 3 = 21 ≤ 64); isključene vrste se ne zakazuju (i otkazuju); wind-down večeri prije vikend-dana računa se iz vikend buđenja; jutarnja obavijest vikendom pomaknuta za razliku vikend − radni dan buđenja (zadana jutarnja = buđenje). Podsjetnici blokova: isti horizont 7 dana, budžet ostaje 64 − dnevne − 4. Testovi.
4. Jezik: `settings.language: system | hr | en`; app pri pokretanju primjenjuje spremljenu preferenciju; Profil sprema izbor u settings (trajno). Onboarding nudi i "Jezik uređaja".
5. Onboarding: **0–3 zabrane** (korak se može preskočiti bez zabrane); korak sna dobiva vikend buđenje (zadano = radni dan) + upozorenje kad je razlika > 1 h.
6. Profil: prekidač za svaku od tri dnevne obavijesti (sprema + resync), vikend/radni dan buđenje; **kartica "Obavijesti su isključene" s gumbom "Otvori postavke"** (`Linking.openSettings`) kad je dopuštenje odbijeno — na Profilu i na Danas.
7. Doba dana prema buđenju: zora = buđenje → +3 h, dan do večeri, večer = krevet − 5 h (zadano 07:00 / 8 h → zora 07–10, dan 10–18, večer od 18; sada je fiksno 05/09/18); prije buđenja = večer. Theme provider čita postavke. Testovi.
8. Privremena ikona/splash (narančasti orb na tamnoj pozadini, PNG generiran skriptom), `app.json` boje. i18n HR/EN za sve. Provjere `tsc`, `lint`, `test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriteriji koraka: vikend buđenje + upozorenje > 1 h (1, 2, 5), `language: system` (1, 4), 0–3 zabrane (5), prekidači tri dnevne obavijesti (1, 3, 6), horizont 7 dana (3), kartica za odbijeno dopuštenje (6), doba dana prema buđenju (7), ikona/splash (8). Odluka u izvedbi (nije Bornova): vikend = subota i nedjelja; jutarnja obavijest vikendom se pomiče s buđenjem, a wind-down prati buđenje sljedećeg dana — zapisati kao napomenu/pitanje. Granica večeri (krevet − 5 h) je moja pretpostavka da zadane vrijednosti ostanu slične — pitanje za Bornu. Prekidač za podsjetnike blokova nije dio koraka (pitanje 28 otvoreno). Korak je velik: radim redom 1→8 i commitam nakon svake cjeline; ako ponestane budžeta, nastavak na `wip/korak-13c`.

**Napravljeno:**
- Bez novih ovisnosti. Migracija `0002_settings_refinements`: `settings` + `weekend_wake_time` (NULL = kao radni dan) i `morning_notif_enabled` / `evening_notif_enabled` / `wind_down_notif_enabled` (zadano uključeno); `language` sada `system | hr | en`. Test migracije nad postojećim redom postavki.
- Čisto `src/core/schedule/wake.ts`: vikend = subota i nedjelja, `wakeTimeFor`, `bedtimeOn` (krevet prati buđenje *sljedećeg* dana), `wakeShiftMinutes` (najkraćim putem preko ponoći), `weekendWakeWarning` (> 60 min).
- Okidači: horizont **7 dana** (21 dnevna obavijest; podsjetnici blokova dobivaju 64 − 21 − 4 = 39 mjesta, isti horizont); isključene vrste se ne zakazuju, a već zakazane se otkažu; jutarnja vikendom pomaknuta za razliku vikend − radni dan; wind-down se računa po noći iz buđenja sljedećeg dana (petak i subota navečer prate vikend buđenje, ispravno i iza ponoći).
- Onboarding: jezik nudi "Jezik uređaja" (zadano); korak sna ima buđenje radnim danom i vikendom (vikend prati radni dan dok se ne promijeni) + upozorenje > 1 h + krevet za petak/subotu; zabrane **0–3** (korak se može preskočiti).
- `features/settings`: zajedničko stanje postavki (`loadSettings`, `updateSettings`, `useSettings`) — učitavanje/spremanje primijeni jezik i granice doba dana, spremanje ponovo zakaže obavijesti. Jezik je sada trajno spremljen (i `system`).
- Profil (`features/profile`): jezik, buđenje radni dan / vikend s upozorenjem, **prekidač za svaku od tri dnevne obavijesti** (s vremenom, vikend jutro posebno). Sve se sprema odmah.
- **Kartica "Obavijesti su isključene"** s gumbom **Otvori postavke** (`Linking.openSettings`) na Danas i Profilu kad je dopuštenje odbijeno; sync javlja stanje dopuštenja pri svakoj provjeri (i po povratku iz postavki).
- **Doba dana prema buđenju:** zora = buđenje → +3 h, dan do 5 h prije kreveta, zatim večer (07:00 / 8 h → 07–10 / 10–18 / 18+); radi i preko ponoći; vikendom prema vikend buđenju. Dok nema postavki, stare fiksne granice.
- "Što imaš sutra?" slaže termine od sutrašnjeg buđenja (vikendom vikend vrijeme).
- **Privremena ikona i splash:** narančasti orb na tamnoj pozadini (`scripts/generate-placeholder-icons.py`, Pillow); iOS koristi `icon.png` (uklonjen template `expo.icon`), Android adaptive i splash na `#0B0B10`. `ClockStepper` premješten u `src/ui`.
- 14 novih testova (ukupno 366). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (366/366), `expo export --platform android` ✅ (4.4 MB).

**Problemi/napomene:**
- Nije isprobano na uređaju (sandbox): Switch, kartica dopuštenja i povratak iz postavki, nova ikona/splash (treba novi dev build da se vide ikona i splash).
- Odluke u izvedbi (moje, ne Bornove): vikend = subota i nedjelja; jutarnja obavijest se vikendom pomiče za istu razliku kao buđenje; večernji upit ostaje isto vrijeme svaki dan; večer počinje 5 h prije kreveta.
- Vremena jutarnje/večernje obavijesti i sati sna se zasad mijenjaju samo u onboardingu (Profil ima buđenje i prekidače).
- Supabase shema (korak 17) mora pratiti nove stupce `settings`.

**Pitanja za Bornu:**
29. Vikendom se jutarnja obavijest pomiče zajedno s buđenjem (npr. 07:00 → 09:00), a večernji upit ostaje isti. Odgovara li, ili želiš i večernji upit vikendom drukčije?
30. Večer (tamniji gradijent) počinje 5 h prije kreveta (uz 23:00 krevet = 18:00). Odgovara li ta granica?
31. Treba li u Profilu i uređivanje vremena obavijesti i sati sna (zasad samo u onboardingu)?

**Sljedeće:** korak 14 — jutarnji brief (ekran iz notifikacije: pozdrav, prijava sna, kartice dana, Prilagodi / Kreni).

## 2026-11-09 22:43 · Korak 13b — Podsjetnici blokova
**Plan (recenziran prije koda):**
1. Grana `wip/korak-13b`; bez novih ovisnosti i bez migracije.
2. Čisto u `src/core/notifications/block-reminders.ts`: id podsjetnika `block:<blokId>@<dan>T<HH:MM>` (promjena termina → novi id), odgoda `snooze:<blokId>`; `upcomingBlockReminders(blocks, now, limit)` — samo `planned`, sve vrste osim sna, okida na početku bloka, strogo poslije `now`, sortirano, unutar budžeta; `blockReminderBudget` = 64 − dnevni okidači − rezerva za odgode; `SNOOZE_MINUTES = 15`, `snoozeFireAt`; `planBlockReschedule` (otkaži zastarjele, zakaži nedostajuće; odgode blokova koji više nisu planirani se otkazuju); `blockActionEffect(block, action)` → označi gotovo / odgodi / otvori blok / ništa (blok obrisan ili već riješen). Testovi.
3. Repo `listBlocksBetween(db, user, from, to)` (+ test) za horizont zakazivanja (isti kao dnevne obavijesti, 3 dana).
4. Feature `sync.ts`: zajednički `NotificationRequest` (kategorija, kanal), `syncBlockReminders` kroz isti `NotificationScheduler` adapter, Android kanal `blocks`; `expoScheduler` postavlja `categoryIdentifier`. Testovi s lažnim schedulerom.
5. `notifications-sync`: uz dnevne zakaže i podsjetnike; odgovori — Gotovo → `setBlockStatus(done)` (XP odmah, isti put kao kvačica) + makni obavijest; Odgodi → nova obavijest za 15 min; Iskrslo i dodir → otvori app na Danas s uređivačem tog bloka (puni "Iskrslo" flow je korak 27). Danas se osvježi (store promjena blokova).
6. Ponovno zakazivanje nakon svake promjene blokova (timeline, upit, "Što imaš sutra?").
7. i18n HR/EN (tekst podsjetnika, kanal), provjere `tsc`, `lint`, `test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = obavijest na početku svakog bloka osim sna (2, 4, 5), Gotovo = status + XP (2, 5 — `setBlockStatus` već ne duplicira XP s upitom), Odgodi 15 min (2, 5), Iskrslo otvara app (5), zakazivanje uz dnevne unutar iOS limita (2, 4). Akcije zasad otvaraju app (`opensAppToForeground: true`) jer obrada u pozadini dok je app ugašen nije pouzdana bez dev builda za provjeru — napomena/pitanje. Horizont ostaje 3 dana (7 dana je korak 13c). Isključivanje podsjetnika u Profilu nije u ovom koraku.

**Napravljeno:**
- Bez novih ovisnosti, bez migracije.
- Čisto u `src/core/notifications/block-reminders.ts`: id `block:<blokId>@<dan>T<HH:MM>` i odgoda `snooze:<blokId>`; `needsReminder` (planiran, nije san); `upcomingBlockReminders` (početak bloka, strogo poslije sada, sortirano, do budžeta); `blockReminderBudget` (64 − dnevne − rezerva 4 za odgode); `planBlockReschedule` (zastarjeli podsjetnici i odgode riješenih blokova se otkazuju; dnevne i tuđe se ne diraju); `SNOOZE_MINUTES = 15`, `snoozeFireAt`; `blockActionEffect` (Gotovo/Odgodi samo za planiran blok, Iskrslo otvara blok, obrisan blok → ništa). `localDateTime` iz `triggers.ts` je izvezen.
- Repo `listBlocksBetween(db, user, from, to)`.
- `features/notifications/sync.ts`: zajednički `NotificationRequest` (kanal + kategorija akcija), `syncBlockReminders`, `scheduleSnooze` (zamjenjuje prethodnu odgodu bloka), `cancelBlockReminders`; Android kanal `blocks` (HIGH); `expoScheduler` postavlja `categoryIdentifier`.
- `syncNotificationsNow`: uz dnevne zakazuje podsjetnike za blokove od danas do +2 dana (isti horizont), unutar ostatka limita iOS-a; bez dopuštenja otkazuje i njih; poziv dok sync traje pokreće još jedan prolaz (promjena blokova se ne gubi).
- Akcije: **Gotovo** → `setBlockStatus(done)` (isti put kao kvačica: status + XP u transakciji, upit ne duplicira) + osvježi Danas/upit + resync; **Odgodi** → nova obavijest za 15 min; **Iskrslo** → app se otvori na Danas s uređivačem tog bloka (ako je blok danas). Dodir podsjetnika samo otvara app. Obavijest se nakon akcije miče iz centra obavijesti.
- Ponovno zakazivanje nakon svake promjene blokova: timeline (dodaj/uredi/obriši/kvačica), spremanje upita, "Što imaš sutra?".
- i18n HR/EN (`notifications.block.*`, `notifications.channel.blocks`).
- 18 novih testova (ukupno 352). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (352/352), `expo export --platform android` ✅ (4.4 MB).

**Problemi/napomene:**
- Nije isprobano na uređaju (sandbox). Akcije zasad **otvaraju app** (`opensAppToForeground: true`) jer obrada u pozadini dok je app ugašen nije pouzdana bez provjere na dev buildu; Gotovo/Odgodi bi idealno radili bez otvaranja — provjeriti na uređaju (pitanje 27).
- Iskrslo za blok koji nije današnji (npr. sutrašnji) samo otvara Danas. Puni "Iskrslo" flow je korak 27.
- Blokovi preko 3 dana unaprijed dobivaju podsjetnik tek kad uđu u horizont (pri otvaranju appa); horizont 7 dana dolazi u 13c — tada provjeriti budžet (7 × 3 dnevne = 21, ostaje 39 za blokove).
- Android 12+: točno vrijeme okidanja ovisi o dopuštenju za exact alarm (nije traženo; obavijesti mogu kasniti nekoliko minuta).
- Isključivanje podsjetnika blokova u Profilu nije dio koraka (13c ima prekidače samo za tri dnevne obavijesti).

**Pitanja za Bornu:**
27. Da li Gotovo i Odgodi na podsjetniku smiju raditi bez otvaranja appa (kad se provjeri na uređaju), ili ti je ok da se app otvori?
28. Želiš li prekidač u Profilu i za podsjetnike blokova (uz tri dnevne obavijesti iz 13c)?

**Sljedeće:** korak 13c — postavke i onboarding: dorade (vikend buđenje, `language: system`, 0–3 zabrane, prekidači obavijesti, horizont 7 dana, kartica za odbijeno dopuštenje, doba dana prema buđenju, privremena ikona/splash).

## Promjena koncepta (Borna, 2026-11-09 21:14) — dijagnoze, napredak, trackeri
Borna je proširio koncept; detalji u `docs/CONCEPT.md` (sekcije Dijagnoze, Napredak u odnosu na prošlost, Opcionalni trackeri, Gamifikacija) i u Claude Docs konceptu. `BUILD_PLAN.md` je usklađen (16, 16b, 31, 31b, 34, 34b, 36–37c, 42).
- **Dijagnoze** umjesto "izvještaja": svaku večer dan; nedjeljom dan + tjedan; kraj mjeseca dan + tjedan + mjesec; 31. 12. sve četiri. Struktura: Ukratko → Napredak → Pohvale → Što smo primijetili → Veliki problemi → Ideje za napredak. Detaljno, psihološki, iskreno ali nikad bezobrazno. Najvažniji dio appa — kvaliteta promptova je prioritet.
- **Napredak naspram prošlosti, ne savršenstva**: dnevni rezultat 0–100, usporedbe s jučer / prošli tjedan / mjesec / godina, osobni rekordi, streak boljih tjedana. Mora se vidjeti na prvi pogled.
- **Gamifikacija**: streakovi, questovi, bedževi; lagani Solo Leveling štih (rang E–S, statovi). Ne mora biti "igrica".
- **Opcionalni trackeri** (isključeni po defaultu): kalorije (cilj vs pojedeno), novac (limit potrošnje vs potrošeno, po želji stanje). **Raspoloženje se ne prati** (Borna odlučio 2026-11-09 22:02).

## Odluke (Borna, 2026-11-09) — odgovori na pitanja 1–24
Ovo su Bornove odluke; vrijede za sve sljedeće korake. Pitanja 1–24 su zatvorena.
- **Večernji upit (12b):** checklist ima tri opcije **U redu / Djelomično / Nije** (`partial`); za Djelomično i Nije odmah u checklisti pitanje **"kad kasnije?"** (sutra / drugi dan / preskoči). Upit ispunjen **prije 04:00 pripada prethodnom danu**. Glavni streak = postoji ocjena dana (ostaje); dan samo s "Nešto je iskrslo" bez upita **ne** čuva streak. (P8, 9, 21, 22, 23)
- **XP:** zadatak bez težine = lagani + bonus za planirani termin (**15**), samo blokovi vrste Zadatak (P20). **Kvačica Gotovo na timelineu daje XP odmah**; upit samo potvrđuje i ne smije duplicirati (P18). Djelomično daje **pola XP-a zadatka, zaokruženo naviše** (15 → 8) (P24).
- **Baza:** jedinstveni indeksi — jedan jutarnji i jedan večernji checkin po danu, jedan `rule_log` po zabrani po danu (P7). `rule_logs` model odgovara (P6).
- **Podsjetnici blokova (13b, mali korak nakon 13):** za **sve blokove osim sna**, s akcijama Gotovo / Odgodi / Iskrslo; **Odgodi = 15 min** (P16, 19).
- **Postavke i onboarding:** dodati **vikend vrijeme buđenja** + upozorenje ako je razlika > 1 h (P10); `settings.language` dobiva **`system`** (P5, 11); onboarding dopušta **0–3 zabrane** (P13); zadana vremena ostaju (P12); svaka od tri dnevne obavijesti se može **isključiti** u Profilu (P14); horizont zakazivanja **7 dana** (P15); kad je dopuštenje odbijeno — **kartica s gumbom "Otvori postavke"** (P17).
- **Dizajn:** paleta ostaje (P1); granice doba dana **prate vrijeme buđenja** (npr. zora = buđenje do +3 h) (P2); tema prati sustav, tamna zadana (P3); napraviti **jednostavnu privremenu ikonu/splash** (narančasti orb na tamnoj pozadini) (P4).
- **Accounti (2026-11-09):** Supabase projekt **`ritam`** postoji (org `umetnix`, ref `imsbokdyusrwyvyjvjfw`, regija eu-central-1, URL `https://imsbokdyusrwyvyjvjfw.supabase.co`, besplatni plan). Koraci 17–19 rade s pravim projektom: migracije ostaju u `supabase/migrations/` (izvor istine), a na remote se primjenjuju tek kad prođu lokalno. URL i publishable ključ idu u `.env` kao `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY` (`.env` u `.gitignore`, u repou samo `.env.example`). **Anthropic API ključ Borna sam upisuje** u Supabase → Edge Functions → Secrets kao `ANTHROPIC_API_KEY`; nikad u repo ni chat. Borna ima Expo (EAS) account za development build.
- **LLM (2026-11-09):** Borna je upisao `ANTHROPIC_API_KEY` u Supabase secrets projekta `ritam` (jedan ključ za sve modele). Modeli po funkciji, kao postavka u Edge Functionu (ne u kodu appa): **plan-day i write-report → `claude-sonnet-5-5`**, **parse-input → `claude-haiku-5-5`**. Ključ se prvi put provjerava u koraku 20 (MCP nema popis secreta).


## 2026-11-09 20:43 · Korak 13 — Večernji upit: "Što imaš sutra?"
**Plan (recenziran prije koda):**
1. Grana `wip/korak-13`; `npm ci`. Bez novih ovisnosti i bez migracije (blokovi idu u postojeći `schedule_blocks`).
2. Čisto u `src/core/schedule/tomorrow.ts`: `QUICK_PICKS` (brzi odabiri: id, vrsta, trajanje — npr. posao/škola fiksno, trening/učenje/obaveze zadatak); `planStartMinutes(wakeTime)` (buđenje + 30 min, na četvrt sata); `nextFreeSlot(occupied, minutes, wakeTime)` (nastavlja iza zadnjeg bloka, ne prije buđenja, unutar dana); `parseTypedEntry(text)` — lokalno prepoznaje vrijeme u tipkanom tekstu ("Trening 18-19", "sastanak 9:30–11", "zubar u 15") i ostatak je naziv (LLM `parse-input` dolazi u koraku 21); `quickPickDraft` / `typedDraft` → `BlockDraft`; `tomorrowDraftsValid`. Testovi.
3. Repo `createBlocks(db, user, inputs)` — svi blokovi u jednoj sinkronoj transakciji (sve ili ništa). Test nad Node SQLite-om.
4. UI `src/features/evening/tomorrow-plan.tsx`: ekran "Što imaš sutra?" — gore "već u planu" (sutrašnji blokovi, npr. premješteni iz "kad kasnije?"), brzi odabiri (čipovi), polje za tipkanje + Dodaj, popis novih stavki (dodir → postojeći `BlockEditor` za vrijeme/naziv/vrstu, ukloni), Potvrdi (sprema) / Preskoči.
5. Ulaz: nakon spremanja upita ekran potvrde (+XP) nudi "Što imaš sutra?" (koncept: izvještaj, pa sutra); kartica upita kad je ispunjen nudi i "Planiraj sutra". Sutra = dan upita + 1 (prije 04:00 → današnji dan). Nakon potvrde osvježi Danas.
6. i18n HR/EN (`evening.tomorrow.*`, nazivi brzih odabira) + pristupačnost.
7. Provjere `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = ručni unos (brzi odabiri 2/4 + tipkanje 2/4), pregled (4), potvrdi (3/4). Google Calendar (24), glas (30) i LLM (21) su drugi koraci — ne sada; tipkano se lokalno pretvara u jedan blok po unosu, bez LLM-a. Brzi odabiri su fiksni popis (bez učenja iz povijesti) — pitanje za Bornu. Vrijeme brzog odabira se slaže iza zadnjeg bloka od buđenja; korisnik ga mijenja u editoru. Blokovi su `source: user`, `status: planned`. Dnevni izvještaj (16) još ne postoji, pa "sutra" ide odmah iza potvrde upita.

**Napravljeno:**
- Bez novih ovisnosti, bez migracije.
- Čisto u `src/core/schedule/tomorrow.ts`: `QUICK_PICKS` (Posao 8 h i Škola/faks 6 h fiksno, Trening 1 h, Učenje 1,5 h, Obaveze 1 h, Kućanski poslovi 1 h, Čitanje 30 min kao zadatak, Druženje 2 h fiksno), `tomorrowOf`, `planStartMinutes` (buđenje + 30 min), `nextFreeSlot` (iza zadnjeg bloka, ne prije buđenja, unutar dana), `parseTypedEntry` (lokalno prepoznaje "Trening 18-19", "od 9:30 do 11", "10.15–11.45", "Zubar u 15", "at 9:30", "ručak 13:00"; neispravno vrijeme ostaje u nazivu), `typedDraft` (samo početak → 1 h; bez vremena → sljedeći slobodni termin), `isTomorrowPlanValid`, `tomorrowInputs` (`user` / `planned`, po početku).
- Repo `createBlocks` — svi blokovi plana u jednoj sinkronoj transakciji, neispravan ulaz → ništa se ne zapisuje.
- UI `TomorrowPlan` (`src/features/evening/tomorrow-plan.tsx`, cijeli ekran): "Već u planu" (sutrašnji blokovi, npr. premješteni iz "kad kasnije?"), čipovi brzog odabira, polje za tipkanje + Dodaj, "Novo za sutra" (dodir → postojeći `BlockEditor` za naziv/vrijeme/vrstu, Ukloni), Preskoči / Potvrdi → potvrda s brojem novih blokova. `useTomorrowPlan` (blokovi dana + vrijeme buđenja iz postavki).
- Ulazi: ekran potvrde upita (+XP) ima "Što imaš sutra?"; kartica upita kad je ispunjen ima "Planiraj sutra". Sutra = dan upita + 1 (upit prije 04:00 → današnji dan, pa se timeline osvježava nakon spremanja). `formatDay` premješten u `features/today/format-day.ts`.
- i18n HR/EN (`evening.tomorrow.*`, `evening.card.planTomorrow`, `evening.done.planTomorrow`).
- 34 nova testa (ukupno 334). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (334/334), `expo export --platform android` ✅.

**Problemi/napomene:**
- Nije isprobano na uređaju/simulatoru (sandbox) — provjereno typecheckom, lintom, testovima i bundleom.
- Prijelaz iz upita na "Što imaš sutra?" ima pauzu od 400 ms jer iOS ne prikaže novi modal dok se prethodni zatvara — provjeriti na uređaju.
- Termini brzih odabira se slažu jedan iza drugog od buđenja (bez praznina, bez provjere preklapanja s tipkanim terminima); korisnik ih mijenja u editoru. Pravi raspored slaže LLM u koracima 21–22.
- Tipkani unos daje jedan blok po unosu i uvijek vrstu Zadatak (i kad ima vrijeme); mijenja se u editoru.
- Naziv brzog odabira sprema se na jeziku koji je aktivan u trenutku dodavanja.

**Pitanja za Bornu:**
25. Brzi odabiri su zasad fiksni popis od 8 (Posao, Škola/faks, Trening, Učenje, Obaveze, Kućanski poslovi, Čitanje, Druženje) sa zadanim trajanjima. Odgovara li popis, ili želiš da se kasnije uče iz tvojih čestih blokova / da ih uređuješ u Profilu?
26. Tipkani blok s navedenim vremenom (npr. "Zubar u 15") — da bude Fiksno umjesto Zadatak? Zasad je Zadatak (daje XP), a vrsta se mijenja u editoru.

**Sljedeće:** korak 13b — podsjetnici blokova (obavijest na početku svakog bloka osim sna; Gotovo / Odgodi 15 min / Iskrslo).

## 2026-11-09 18:43 · Korak 12b — Večernji upit: dorade (odluke 2026-11-09)
**Plan (recenziran prije koda):**
1. Grana `wip/korak-12b`; `npm ci`. Bez novih ovisnosti.
2. Migracija `0001` (drizzle-kit + ručni dodaci): `checkin_items` dobiva `outcome` (`ok` / `partial` / `not`, popunjeno iz `ok`), `later_date` (kamo je premješteno; NULL = preskoči) i `moved_block_id`; prije indeksa uklanja duplikate (ostaje najnoviji); **jedinstveni indeksi** `checkins(user_id, date, kind)` i `rule_logs(rule_id, date)`. Domenske Zod sheme prate (`ok` ostaje = `outcome === 'ok'`). Test migracije nad Node SQLite-om.
3. Čisto u `src/core/checkin/evening.ts`: odgovor checkliste `outcome: ok | partial | not | null` + `later: tomorrow | other | skip | null` + `laterDate`; validacija (Djelomično/Nije traži "kad kasnije?", "drugi dan" traži dan 2–7 dana unaprijed); `blockStatusAfterCheckin` (U redu → `done`, Djelomično → `partial`, Nije + kasnije → `moved`, Nije + preskoči → `skipped`); `movedBlockInput` (isti naziv i vrijeme na novi dan, `planned`); `eveningCheckinDate(now)` (prije 04:00 → prethodni dan); nacrt iz spremljenog upita vraća i "kad kasnije?".
4. XP zadatka **izveden iz statusa bloka** (`taskXpForBlock`: zadatak `done` → 15, `partial` → ceil(15/2) = 8, ostalo 0) i jedna sinkronizacija po bloku (`syncBlockTaskXp`: obriši XP zadatka tog bloka, upiši ispravan). Koristi je i kvačica timelinea (XP odmah) i upit → nikad duplicirano; upit sam piše samo XP upita (15) i zabrana.
5. Repo: `setBlockStatus` (transakcija: status + XP) za kvačicu; `deleteBlock` briše i XP zadatka bloka; `saveEveningCheckin` — statusi + XP preko sinkronizacije, premješteni blokovi stvoreni/ažurirani/obrisani (ponovno spremanje ne duplicira; dirnuti premješteni blok se ne briše). Testovi.
6. UI: checklist s tri opcije **U redu / Djelomično / Nije**; za Djelomično/Nije komentar + "Kad kasnije?" (Sutra / Drugi dan / Preskoči; Drugi dan → izbor dana). Upit koristi vlastiti datum (prije 04:00 jučerašnji) i učitava blokove tog dana; kvačica osvježava i upit. i18n HR/EN.
7. Provjere `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = Djelomično s pola XP-a (3, 4, 6), "kad kasnije?" s novim blokom i statusom (3, 5, 6), upit prije 04:00 (3, 6), XP odmah na kvačicu bez dupliciranja (4, 5), jedinstveni indeksi (2). Odluka o statusu: Djelomično **ostaje `partial`** i kad se ostatak premjesti (da XP za djelomično ne nestane), a premješta se samo ostatak kao novi blok; Nije + kasnije → `moved` — zapisano kao napomena. Promjena modela `checkin_items` (outcome, later_date, moved_block_id) je nužna da Djelomično i premještanje prežive ponovno otvaranje upita; Supabase shema (korak 17) će to pratiti.

**Napravljeno:**
- Bez novih ovisnosti.
- Migracija `0001_evening_refinements`: `checkin_items` + `outcome` (`ok` / `partial` / `not`, postojeći "Nije" popunjeni kao `not`), `later_date`, `moved_block_id`; uklanjanje duplikata (ostaje najnoviji); jedinstveni indeksi `checkins(user_id, date, kind)` i `rule_logs(rule_id, date)`. Dedupe i popunjavanje ručno provjereni nad starom shemom s duplikatima. Zod shema stavke prati (`ok` mora odgovarati `outcome`, "U redu" se ne premješta).
- Čisto u `src/core/checkin/evening.ts`: odgovor `outcome` + `later` (`tomorrow` / `other` / `skip`) + `laterDate`; nacrt nosi `date`; `eveningCheckinDate` (prije 04:00 → jučer), `otherDayOptions` (+2 … +7 dana), `resolveLaterDate`, `isChecklistAnswerValid`, `blockStatusAfterCheckin(outcome, movedTo)`, `taskXpForBlock` (zadatak `done` 15, `partial` 8), `movedBlockFields`; `eveningXpAwards` sada samo upit + zabrane. `xpForTaskPartial` u gamifikaciji (ceil pola).
- Repo: `block-xp.ts` (`syncBlockTaskXp` — XP zadatka bloka uvijek točno jedan, izveden iz statusa); `setBlockStatus` (kvačica: status + XP u transakciji); `updateBlock` usklađuje XP kad se promijeni status/vrsta/dan; `deleteBlock` briše i XP bloka (sada sinkron); `saveEveningCheckin(db, user, draft)` — statusi i XP preko iste sinkronizacije, premješteni blokovi (novi / ponovo korišteni i preseljeni / obrisani dok su neodrađeni; odrađeni se ne diraju), zapis zabrane zamjenjuje i drugi zapis istog dana.
- UI: checklist **U redu / Djelomično / Nije**; za Djelomično i Nije komentar + "Kad kasnije?" (Sutra / Drugi dan / Preskoči; Drugi dan → popis dana). Upit ima vlastiti dan (`useNow().eveningDate`) i učitava blokove tog dana; kartica prije 04:00 piše "Večernji upit · jučer"; kvačica na timelineu odmah daje XP i osvježava upit. i18n HR/EN.
- 15 novih testova (ukupno 300). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (300/300), `expo export --platform android` ✅ (4.4 MB).

**Problemi/napomene:**
- Nije isprobano na uređaju/simulatoru (sandbox) — provjereno typecheckom, lintom, testovima i bundleom.
- Odluka u izvedbi: Djelomično ostaje `partial` i kad se ostatak premjesti (novi blok za ostatak), da 8 XP-a za odrađeni dio ne nestane; Nije + kasnije → `moved`, Nije + preskoči → `skipped`.
- Premješteni blok dobiva isti termin na novi dan (ne provjerava se preklapanje); kalendarski/iskrsli blok premješten rukom postaje Fiksno.
- `xp_events` s `source = 'task'` i `sourceId = blok` je sada rezerviran za XP izvršenja bloka — korak 27 ("Iskrslo", +5 za preraspoređivanje) mora koristiti drugi `sourceId` ili izvor.
- Kvačica nakon spremljenog upita mijenja status i XP, ali ne i stavku upita; ponovno otvaranje upita prikazuje spremljeni odgovor (ne trenutni status).
- Supabase shema (korak 17) mora pratiti nove stupce `checkin_items` i jedinstvene indekse.

**Pitanja za Bornu:** nema novih.

**Sljedeće:** korak 13 — večernji upit: "Što imaš sutra?" (ručni unos blokova za sutra: brzi odabiri + tipkanje, pregled, potvrdi). Premješteni blokovi iz "kad kasnije?" već se pojavljuju na sutrašnjem danu.

## 2026-11-09 13:43 · Korak 12 — Večernji upit: checklist
**Plan (recenziran prije koda):**
1. Grana `wip/korak-12`; `npm ci`. Bez novih ovisnosti i bez nove migracije (tablice `checkins`, `checkin_items`, `rule_logs`, `xp_events` već postoje).
2. Čisto u `src/core/checkin/evening.ts`: koraci `checklist → rules → rating` (korak zabrana se preskače ako danas nijedna ne vrijedi); `checklistBlocks(blocks)` (svi blokovi dana osim sna); `rulesActiveOn(rules, date)` (po `activeDays`); nacrt `{ items: [{ blockId, ok: bool|null, comment }], rules: [{ ruleId, kept: bool|null, trigger }], rating, note }`; `createEveningDraft(blocks, rules, date, saved?)` (blok `done` → unaprijed "U redu"; postojeći upit tog dana → njegovi odgovori); validacija po koraku (sve stavke odgovorene, ocjena 1–5); `blockStatusAfterCheckin` (U redu → `done`, Nije → `skipped`, `partial`/`moved` ostaju); `eveningXpAwards` (upit 15, zabrana po težini 5/10/20, zadatak "U redu" po tablici iz koraka 7). Testovi.
3. Repo `src/db/repos/checkins.ts`: `getEveningCheckin(db, user, date)` (checkin + stavke + rule_logs) i `saveEveningCheckin(...)` u **jednoj sinkronoj transakciji**: upsert večernjeg checkina (jedan po danu), stavke (`kind: task`, `refId` = blok), rule_logs (okidač samo za prekršaj), statusi blokova, xp_events. Ponovni upit istog dana zamjenjuje svoje stavke/logove/XP (bez dupliciranja XP-a). Testovi nad Node SQLite-om (spremanje, ponavljanje, sve-ili-ništa).
4. UI `src/features/evening/`: `EveningCheckinFlow` (cijeli ekran u `Modal`, napredak "1/3", Natrag/Dalje/Spremi): checklist — kartica po bloku s U redu / Nije, za Nije polje komentara; zabrane — Držao sam se / Prekršio sam, za prekršaj polje okidača; ocjena — 1–5 + rečenica. Nakon spremanja kratka potvrda s XP-om.
5. Ulaz: kartica "Večernji upit" na tabu Danas (Ispuni / Ispunjeno ✓ + Uredi); dodir večernje obavijesti otvara upit (mali store namjere u `features/notifications` koji Danas sluša).
6. i18n HR/EN za sve nove tekstove (+ pristupačnost).
7. Provjere `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = checklist U redu / Nije + komentar (2, 4), zabrane (2, 4), ocjena dana (2, 4), sprema checkin + checkin_items + rule_logs + xp_events (3). Koncept točke 3 (otvorena pitanja), "kad kasnije?" za zadatke i dnevni izvještaj su drugi koraci (16, 13/27) → ne sada, zapisano kao pitanja. Glas nije u ovom koraku (30). XP: tablica iz koncepta, bez kazni; blok nema težinu (zadaci s težinom dolaze u koraku 25) → zadatak "U redu" = lagani + bonus za planirani termin (15), samo za blokove vrste `task` — odluka zapisana kao pitanje. Glavni streak već čita `dayRating` (korak 7), pa ga spremljeni upit automatski produljuje. Datum upita = današnji lokalni dan (upit poslije ponoći ide na novi dan) — pitanje.

**Napravljeno:**
- Bez novih ovisnosti, bez nove migracije.
- Čisto u `src/core/checkin/evening.ts`: koraci `checklist → rules → rating` (zabrane se preskaču kad danas nijedna ne vrijedi), `checklistBlocks` (bez sna), `weekdayOf` / `rulesActiveOn`, `createEveningDraft` (gotovi blokovi unaprijed "U redu"; već spremljen upit → njegovi odgovori), `isEveningStepValid` / `isEveningDraftComplete`, `blockStatusAfterCheckin` (U redu → `done`, Nije → `skipped`, `partial`/`moved` ostaju), `eveningXpAwards` (upit 15, zabrana 5/10/20, zadatak "U redu" 15 = lagani + planirani termin; bez kazni), `cleanText`, `sumAwards`.
- Repo `src/db/repos/checkins.ts`: `getEveningCheckin`, `saveEveningCheckin` (jedna sinkrona transakcija: checkin, `checkin_items` s `kind: task` i `refId` = blok, `rule_logs` s okidačem samo za prekršaj, statusi blokova, `xp_events`; ponovno spremanje istog dana zamjenjuje stavke/zapise/XP tog upita — XP se ne duplicira, XP drugih izvora ostaje), `listXpEvents`.
- `src/features/evening/`: `useEveningCheckin` (zabrane koje danas vrijede + spremljeni upit), `EveningCheckinFlow` (cijeli ekran u `Modal`: napredak, Natrag/Dalje/Spremi, Zatvori; nakon spremanja "+N XP" potvrda), koraci `ChecklistStep` (U redu / Nije + komentar), `RulesStep` (Držao sam se / Prekršio sam + okidač, prikazuje "zašto"), `RatingStep` (1–5 + rečenica), `EveningCard` na tabu Danas (Započni / Ispunjeno ✓ s ocjenom + Uredi).
- Dodir večernje obavijesti otvara upit (`features/notifications/open-requests.ts`, Danas ga otvori čim su podaci učitani).
- `ChoiceGroup` prima `selected: null` (još bez odgovora).
- i18n HR/EN (`evening.*`).
- 21 novi test. Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (285/285), `expo export --platform android` ✅ (4.2 MB).

**Problemi/napomene:**
- Nije isprobano na uređaju/simulatoru (sandbox) — provjereno typecheckom, lintom, testovima i bundleom.
- Kvačica na timelineu nakon spremljenog upita mijenja samo status bloka, XP se ne preračunava dok se upit ponovo ne spremi (Uredi).
- Upit poslije ponoći ide na novi dan (vidi pitanje 22).
- Glasovni komentar (korak 30), "kad kasnije?" za zadatke, otvorena pitanja dana i dnevni izvještaj nisu dio ovog koraka.

**Pitanja za Bornu:**
20. XP za zadatak "U redu" u upitu: blokovi još nemaju težinu, pa računam kao lagani zadatak + bonus za planirani termin (15 XP), samo za blokove vrste Zadatak (ne Fiksno/Kalendar). Odgovara li, ili želiš drukčiju zadanu težinu?
21. "Nije" postavlja blok na `skipped` (preskočeno). Želiš li u upitu i izbor "Djelomično" (status `partial`)?
22. Ako upit ispuniš poslije ponoći (npr. u 00:30), ide na novi dan i jučerašnji streak puca. Da upit do npr. 04:00 ide na prethodni dan?
23. "Kad kasnije?" za zadatke koji nisu odrađeni (koncept, točka 1) — u kojem koraku: uz 13 ("Što imaš sutra?") ili uz 27 ("Nešto je iskrslo")?

**Sljedeće:** korak 13 — večernji upit: "Što imaš sutra?" (ručni unos blokova za sutra: brzi odabiri + tipkanje, pregled, potvrdi).

## 2026-11-09 10:43 · Korak 11 — Danas: timeline
**Plan (recenziran prije koda):**
1. Grana `wip/korak-11`; `npm ci`. Bez novih ovisnosti (uređivanje u RN `Modal`, vremena stepperom ±15 min kao u onboardingu).
2. Čisto u `src/core/schedule/timeline.ts`: `blockPhase(block, nowMinutes)` → `past` / `current` / `upcoming` (san koji prelazi ponoć: tekući od početka do kraja dana); `currentBlockId(blocks, nowMinutes)` (kod preklapanja — onaj koji je kasnije počeo); `isDone(block)` / `toggledStatus(status)` (`planned` ↔ `done`; ostali statusi pripadaju večernjem upitu, pa ih dodir vraća u `done`).
3. Čisto u `src/core/schedule/block-draft.ts`: nacrt bloka `{ title, start, end, kind }` (ručno: `task` / `fixed`; uređeni blok drugog tipa zadržava svoj tip), `newBlockDraft(blocks, nowMinutes)` (počinje na kraju zadnjeg bloka ili na sljedećih 15 min, traje 1 h, ostaje unutar dana), `shiftDraftStart/End` bez omatanja (kraj uvijek nakon početka), `isBlockDraftValid`, `draftFromBlock`, `draftToInput(draft, date)` (izvor `user`, status `planned`). Testovi za sve rubove (kraj dana, preko ponoći, prazan naziv).
4. `src/features/today/`: `useTodayBlocks()` (učita blokove za današnji lokalni dan, sat se osvježava svake minute, novi dan u ponoć → novi popis; `reload` nakon svake promjene) — preko postojećih repo funkcija (`listBlocksForDate`, `createBlock`, `updateBlock`, `deleteBlock`).
5. UI: ekran Danas (`src/app/index.tsx`) — naslov s datumom (lokaliziran), popis blokova (vrijeme, naziv, tip, kvačica Gotovo), trenutni blok istaknut (akcent okvir + oznaka "Sada"), prošli prigušeni; prazno stanje s pozivom na dodavanje; gumb "+ Dodaj blok". Dodir kartice → uređivanje; `BlockEditor` modal (naziv, početak/kraj, tip, Spremi / Obriši s potvrdom / Odustani).
6. i18n HR/EN za sve nove tekstove.
7. Provjere `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = prikaz blokova dana (5), trenutni blok istaknut (2, 5), označi gotovo (2, 5), ručno dodaj/uredi/obriši (3–5). XP za izvršen blok **ne** pišem ovdje — koncept i plan stavljaju pisanje `xp_events` u večernji upit (korak 12), inače bi se XP dupliciralo; zapisano kao pitanje. Podsjetnici za pojedine blokove (obavijesti s Gotovo/Odgodi/Iskrslo) nisu u kriteriju koraka 11 → ne sada (pitanje 16 i dalje otvoreno). Preklapanje blokova se ne zabranjuje (koncept ništa ne kaže, a fiksne obaveze se mogu preklapati) — samo prikaz. Jutarnji dio sna od jučer se ne prikazuje (pripada jučerašnjem bloku).

**Napravljeno:**
- Bez novih ovisnosti.
- Čisto u `src/core/schedule/`: `timeline.ts` — `blockRange`, `blockPhase` (`past` / `current` / `upcoming`; san preko ponoći je na današnjem timelineu tekući do ponoći), `currentBlockId` (kod preklapanja kasnije započeti), `toggledStatus` (`planned` ↔ `done`), `minutesOfDay`; `block-draft.ts` — nacrt bloka, `newBlockDraft` (nastavlja na kraj zadnjeg bloka ili na prvih punih 15 min, 1 h, unutar dana), `shiftDraftStart` (čuva trajanje) / `shiftDraftEnd` (kraj ≥ početak + 15 min, najkasnije 23:59), `isBlockDraftValid` (ista Zod shema kao spremljeni blok), `draftToInput` (`user` / `planned`), `draftToPatch` (mijenja samo naziv, vrijeme, tip — status i izvor ostaju).
- `src/features/today/`: `useNow` (lokalni dan + minuta, osvježava se svakih 30 s, prelazi na novi dan u ponoć), `useDayBlocks` (učitavanje preko postojećih repo funkcija, akcije dodaj / uredi / obriši / Gotovo, ponovno učitavanje nakon svake), `BlockCard` (vrijeme, naziv, vrsta, kvačica; trenutni blok s akcent okvirom i oznakom "Sada", prošli i gotovi prigušeni, gotovi precrtani), `BlockEditor` (modal: naziv, početak/kraj stepperom ±15 min, vrsta Zadatak/Fiksno, Spremi / Odustani / Obriši s potvrdom), `TodayScreen` (lokalizirani datum, prazno stanje, greška s "Pokušaj ponovo", "+ Dodaj blok"). Tab Danas više nije placeholder.
- i18n HR/EN (`today.*`), uključujući pristupačnost (checkbox, opis kartice).
- 31 novi test. Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (264/264), `expo export --platform android` ✅ (4.4 MB).

**Problemi/napomene:**
- Nije isprobano na uređaju/simulatoru (sandbox) — provjereno typecheckom, lintom, testovima i bundleom.
- Označavanje Gotovo zasad samo mijenja status bloka; XP ne piše (vidi pitanje 18). Večernji upit (korak 12) će iz statusa znati što je napravljeno.
- Blokovi se mogu preklapati; nema upozorenja. Ručno se biraju samo vrste Zadatak i Fiksno; blok druge vrste (kalendar, san, iskrslo) pri uređivanju zadržava vrstu.
- Najkasniji kraj bloka je 23:59 (format `HH:MM` nema 24:00); blok preko ponoći ručno nije moguć (samo san).
- Podsjetnici za pojedine blokove (obavijest s Gotovo/Odgodi/Iskrslo) se još ne zakazuju — čeka odgovor na pitanje 16 i bit će prirodan dio koraka 27 ili zasebnog malog koraka; ne radim bez odluke.

**Pitanja za Bornu:**
18. Treba li kvačica "Gotovo" na timelineu odmah dati XP (10/25/50 po težini zadatka, +5 u planiranom terminu), ili se XP dodjeljuje tek u večernjem upitu (korak 12) kad potvrdiš dan? Zasad: tek u upitu, da se ne duplicira.
19. Podsjetnik na početku svakog bloka (obavijest s Gotovo/Odgodi/Iskrslo) — želiš li ga za sve blokove, samo za zadatke, ili uključivo u postavkama? I u kojem koraku (predlažem mali zaseban korak nakon 12)?

**Sljedeće:** korak 12 — večernji upit, checklist (U redu / Nije + komentar), zabrane, ocjena dana; sprema checkin + checkin_items + rule_logs + xp_events.

## 2026-11-09 06:43 · Korak 10 — Notifikacije (integracija)
**Plan (recenziran prije koda):**
1. Grana `wip/korak-10`; `npm ci`; `expo-notifications` (SDK 58 → 58.1.8) preko `EXPO_OFFLINE=1 npx expo install`. Config plugin u `app.json`: `["expo-notifications", { "enableRemoteNotifications": false }]` — koncept traži samo lokalne obavijesti, pa bez APNs entitlementa. API provjeren iz tipova paketa (docs.expo.dev nedostupan iz sandboxa).
2. Čisto u `src/core/notifications/`: kategorija akcija `block` (bez `:`/`-`, pravilo paketa) s akcijama `done` / `snooze` / `cameUp` (Gotovo / Odgodi / Iskrslo); `parseNotificationResponse(actionId, data)` → namjera (`open` za dnevne obavijesti, `blockAction` za akcije bloka) ili `null`; payload `data` obavijesti `{ source: 'ritam', kind, triggerId }`; `isDailyTriggerId(id)` da se pri ponovnom zakazivanju otkazuju **samo** naši dnevni okidači.
3. `src/features/notifications/sync.ts` (bez Reacta, s ubrizganim adapterom oko `expo-notifications`): `syncDailyNotifications(api, settings, now, t)` — `getAllScheduled` → `planReschedule` (samo naši id-jevi) → otkaži višak, zakaži nedostajuće s `DATE` okidačem, `identifier = trigger.id`, Android kanal `daily`, tekst na jeziku iz settingsa. Testovi s lažnim adapterom (ništa/sve/djelomično, tuđe obavijesti ostaju, bez dopuštenja se ništa ne zakazuje).
4. `src/features/notifications/setup.ts`: `setNotificationHandler` (prikaži i u prvom planu), Android kanal, registracija kategorije `block` s prevedenim gumbima, `ensurePermission()` — pita samo ako status još nije određen.
5. `NotificationsSync` komponenta u root layoutu unutar `OnboardingGate` (dakle nakon onboardinga — tada se prvi put traži dopuštenje, kako koncept predviđa): pri mountu i svakom povratku appa u prvi plan (`AppState` → `active`) učita settings, osigura dopuštenje i zakaže. Slušatelj odgovora na obavijest parsira namjeru; učinci akcija bloka (označi gotovo, odgodi, iskrslo) dolaze s koracima 11/27 — sada samo bilježi.
6. i18n HR/EN: naslovi i tekstovi triju obavijesti, gumbi akcija, ime Android kanala.
7. Provjere `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`, `expo config` (plugin se razrješava); BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = dopuštenje (4–5), zakazivanje (3), kategorije akcija Gotovo/Odgodi/Iskrslo (2, 4), ponovno zakazivanje pri otvaranju appa (5), config plugin (1). Okidači i horizont dolaze iz koraka 9, ne mijenjam pravila. Koncept: jutarnja obavijest sadrži raspored + prijavu sna — to je jutarnji brief (korak 14); sada je tekst općenit. Podsjetnici za pojedine blokove nisu u ovom koraku (nema ni timelinea, korak 11) — kategorija je spremna za njih. Trajanje "Odgodi" nije definirano u konceptu → pitanje, ne izmišljam.

**Napravljeno:**
- `expo-notifications` 58.1.8 (`EXPO_OFFLINE=1 npx expo install`); config plugin u `app.json` s `enableRemoteNotifications: false` (samo lokalne obavijesti, bez APNs entitlementa — provjereno kroz `expo config`).
- Čisto u `src/core/notifications/`: `actions.ts` — kategorija `block` s akcijama `done` / `snooze` / `cameUp`, payload `data` (`dailyNotificationData`, `blockNotificationData`), `parseNotificationData` i `parseNotificationResponse` → namjera (`open` / `openBlock` / `blockAction`); `permission.ts` — `decidePermission` (`allowed` / `ask` / `denied`, iOS provisional = dopušteno, odbijeno se ne pita ponovo); `triggers.ts` — `isDailyTriggerId`, a `planReschedule` sada gleda samo naše dnevne id-jeve (podsjetnici blokova i tuđe obavijesti se ne otkazuju).
- `src/features/notifications/`: `sync.ts` (`syncDailyNotifications`, `cancelDailyNotifications` preko `NotificationScheduler` adaptera, Android kanal `daily`); `expo-notifications.ts` (jedino mjesto koje zove paket: handler u prvom planu, kanal, kategorija s prevedenim gumbima, `ensurePermission`, `expoScheduler` s `DATE` okidačem i `identifier = trigger.id`); `NotificationsSync` u root layoutu unutar `OnboardingGate` — pri otvaranju appa i svakom povratku u prvi plan učita settings, prvi put zatraži dopuštenje (dakle odmah nakon onboardinga), zakaže; bez dopuštenja otkaže naše obavijesti. `syncNotificationsNow()` je izvezen za kasnije promjene postavki.
- i18n HR/EN: tekstovi triju obavijesti (na jeziku iz settingsa), gumbi Gotovo / Odgodi / Iskrslo, ime Android kanala.
- 25 novih testova (akcije, dopuštenje, filtriranje id-jeva, sync s lažnim adapterom). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (233/233), `expo export --platform android` ✅ (4.3 MB).

**Problemi/napomene:**
- Nije pokrenuto na uređaju — expo-notifications ne radi u Expo Go za sve značajke, treba development build (`eas build --profile development` ili `npx expo run:android|ios`). Provjereno samo typecheckom, lintom, testovima i bundleom.
- Dodir obavijesti zasad samo otvara app: ekrani večernjeg upita (korak 12) i jutarnjeg briefa (korak 14) još ne postoje. Gumbi Gotovo / Odgodi / Iskrslo su registrirani, ali podsjetnici blokova se još ne zakazuju i akcije nemaju učinak — treba timeline (korak 11) i "Nešto je iskrslo" (korak 27). Zasad sve akcije otvaraju app (`opensAppToForeground: true`).
- Promjena jezika ne mijenja tekst već zakazanih obavijesti (id ostaje isti) — novi tekst stiže s okidačima idućih dana. Kad Profil bude spremao jezik u settings (pitanje 11), treba pri promjeni jezika otkazati i ponovo zakazati.
- Android: `DATE` okidač s `bestEffort` isporukom (bez dopuštenja za točne alarme) — obavijest može kasniti nekoliko minuta u Doze načinu.
- docs.expo.dev i Expo API nedostupni iz sandboxa; API provjeren iz tipova paketa u `node_modules/expo-notifications`.

**Pitanja za Bornu:**
16. Koliko traje "Odgodi" na podsjetniku bloka (npr. 10 / 15 / 30 min, ili korisnik bira)? Koncept to ne definira — treba za korak 11/27.
17. Kad korisnik odbije dopuštenje za obavijesti, želiš li u appu (npr. Danas ili Profil) poruku s gumbom za postavke sustava, ili ništa?

**Sljedeće:** korak 11 — Danas: timeline (prikaz blokova dana, trenutni blok istaknut, označi gotovo, ručno dodaj/uredi/obriši blok).

## 2026-11-08 20:43 · Korak 9 — Notifikacije (logika)
**Plan (recenziran prije koda):**
1. Grana `wip/korak-9`; `npm ci`. Bez novih ovisnosti, bez expo-notifications (to je korak 10).
2. `src/core/notifications/triggers.ts` (čisto, bez Reacta): tri vrste okidača — `morning` (jutarnja obavijest), `evening` (večernji upit), `windDown` (krevet − `windDownMinutes`, krevet = buđenje − sati sna, preko postojećeg `bedtimeFor`).
3. `dailyNotificationTimes(settings)` → `{ morning, evening, windDown }` kao "HH:MM" (neispravan ulaz → `null`, kao ostatak `core`-a).
4. `upcomingTriggers(settings, now, { days })` → sortirani popis `{ id, kind, date, time, fireAt }` samo za okidače **nakon** `now`, od danas do `days` dana unaprijed (zadano 3 → najviše 9 obavijesti; tvrda granica 64 = limit iOS-a, `days` se ograničava). `fireAt` se gradi kao lokalno vrijeme uređaja (DST rješava `Date`); `date` je kalendarski dan okidanja. Stabilan `id` = `kind:date`.
5. `planReschedule(scheduledIds, desired)` → `{ toCancel, toSchedule }` (čisto) — za ponovno zakazivanje pri otvaranju appa u koraku 10, da se ne briše i ponovno zakazuje sve.
6. Testovi: zadane vrijednosti (07:00 / 8 h / 45 min → wind-down 22:15), krevet i wind-down preko ponoći, `windDownMinutes = 0`, okidač točno u `now` se preskače, današnji prošli okidači se preskaču, prijelaz mjeseca/godine, sortiranje, granica dana, neispravan ulaz, diff (ništa/sve/djelomično).
7. Provjere `tsc --noEmit`, `expo lint`, `npm test`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = čisto računanje sljedećih okidača (jutro, večer, wind-down) iz settingsa + limit iOS-a — točke 2–4, 6. Vremena dolaze iz `settings` (koje je korisnik postavio u onboardingu), ne izmišljam nova pravila. Tekstovi obavijesti, akcije (Gotovo/Odgodi/Iskrslo), dopuštenja i podsjetnici za blokove su korak 10/11+, ne sada. Točka 5 je mala čista pomoćna funkcija koja služi kriteriju koraka 10 ("ponovno zakazivanje pri otvaranju appa") — ostaje jer je čista logika obavijesti.

**Napravljeno:**
- Bez novih ovisnosti.
- `src/core/notifications/triggers.ts`: vrste `morning` / `evening` / `windDown`; `dailyNotificationTimes(settings)` (wind-down = krevet − `windDownMinutes`, krevet preko postojećeg `bedtimeFor`; 07:00 / 8 h / 45 min → 22:15); `upcomingTriggers(settings, now, { days })` → sortirani `{ id, kind, date, time, fireAt }` strogo nakon `now`, zadano 3 dana (9 obavijesti), horizont ograničen na [1, 21] tako da nikad ne prijeđe limit iOS-a od 64; `fireAt` je lokalno vrijeme uređaja (provjereno i preko prijelaza ljetno/zimsko vrijeme); `planReschedule(scheduledIds, desired)` → `{ toCancel, toSchedule }`.
- Id okidača je `kind:YYYY-MM-DD@HH:MM` — sadrži vrijeme, pa promjena postavki sama otkaže stare okidače i zakaže nove.
- 19 novih testova (pokrenuto i u UTC, Europe/Zagreb i America/New_York). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (208/208).

**Problemi/napomene:**
- Wind-down poslije ponoći (npr. krevet 02:00) pripada kalendarskom danu okidanja, ne "noći prethodnog dana" — za zakazivanje je to točno; ako večernji upit padne iza ponoći, povezivanje s danom checkina riješit će korak 12.
- `windDownMinutes = 0` znači obavijest u vrijeme kreveta (ne "isključeno"). Isključivanje pojedinih obavijesti nije u konceptu ni u `settings` — vidi pitanje 14.
- Horizont od 3 dana: ako korisnik ne otvori app 3 dana, obavijesti prestanu dok ga ponovo ne otvori (korak 10 zakazuje pri svakom otvaranju) — vidi pitanje 15.

**Pitanja za Bornu:**
14. Treba li u postavkama moći isključiti pojedinu obavijest (npr. wind-down), ili su sve tri uvijek uključene?
15. Zakazujem 3 dana unaprijed (tehnički može do 21). Ako app ne otvoriš duže, obavijesti stanu. Želiš li duži horizont (npr. 7 dana), uz rizik da jutarnja obavijest pokaže zastario raspored?

**Sljedeće:** korak 10 — notifikacije (integracija): `expo-notifications`, dopuštenje, zakazivanje okidača iz koraka 9 (`upcomingTriggers` + `planReschedule`), kategorije akcija (Gotovo / Odgodi / Iskrslo), ponovno zakazivanje pri otvaranju appa, config plugin u `app.json`.

## 2026-11-08 13:43 · Korak 8 — Onboarding
**Plan (recenziran prije koda):**
1. Grana `wip/korak-8`; `npm ci`. Bez novih ovisnosti (unos vremena kao stepper ±15 min, ne date-picker paket).
2. Čista logika `src/core/onboarding/`: `bedtimeFor(wake, sleepHours)` (preko ponoći), zadane vrijednosti (buđenje 07:00, 8 h, jutarnja obavijest = buđenje, večernja = krevet − wind-down − 60 min da upit bude *prije* wind-downa, wind-down 45 min), `stepClock` (±15 min s omatanjem), nacrt onboardinga + validacija po koraku i pretvorba u `SettingsInput` i 1–3 `RuleInput` (kroz postojeće Zod sheme). Testovi.
3. Repo za zabrane (`createRule`, `listRules`) + `completeOnboarding(db, userId, draft)` koji u **jednoj transakciji** sprema settings i zabrane (sve ili ništa). Testovi nad Node SQLite-om.
4. Lokalni korisnik: `LOCAL_USER_ID` konstanta dok ne stigne auth (korak 18).
5. UI `src/features/onboarding/`: 4 ekrana redom — jezik → buđenje + sati sna (prikaz izračunatog kreveta) → vrijeme jutarnje/večernje obavijesti → 1–3 zabrane (naziv, zašto, težina 1–3; vrijedi svaki dan, cijeli dan — detaljno uređivanje je korak 28). Natrag/Dalje, gumb Dalje onemogućen dok korak nije ispravan.
6. Root layout: `OnboardingGate` — učita settings; ako ih nema → onboarding, inače tabovi. Jezik iz settingsa primijeni se pri startu (zamjenjuje privremenu in-memory preferenciju za spremljene korisnike).
7. Svi tekstovi HR/EN kroz i18n (+ test da ključevi postoje u oba jezika — već postoji).
8. Provjere `tsc`, `lint`, `test`, `expo export --platform android`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = jezik → buđenje i sati sna → obavijesti → 1–3 zabrane, sprema u settings/rules — točke 2–6. Puni koncept onboarding ima i prijavu (Supabase), Google Calendar, tjedne zadatke, dopuštenje za notifikacije i prvi quest — to su kasniji koraci (18, 24, 25, 10, 34), ne sada. Koncept traži buđenje "odvojeno za radne dane i vikend" + upozorenje o socijalnom jetlagu, ali `settings` ima samo jedan `wakeTime` → ne mijenjam shemu, zapisujem kao pitanje. Nema zakazivanja obavijesti (korak 9/10).

**Napravljeno:**
- Bez novih ovisnosti (vremena se unose stepperom ±15 min).
- `src/core/onboarding/`: koraci `language → sleep → notifications → rules`; `bedtimeFor` (07:00 + 8 h → 23:00, preko ponoći), `shiftClock`, `clampSleepHours` (4–12 h, po 15 min), `splitHours`, `suggestNotificationTimes` (jutarnja = buđenje, večernji upit = krevet − wind-down 45 min − 60 min), `createDefaultDraft`, `isStepValid` / `isDraftComplete` (kroz postojeće Zod sheme), `toSettingsInput`, `toRuleInput` (svaki dan, cijeli dan, `icon: null`).
- `src/db/repos/rules.ts`: `createRule`, `getRule`, `listRules`. `src/db/repos/onboarding.ts`: `completeOnboarding` — settings (upsert) + 1–3 zabrane u **jednoj transakciji**, nepotpun nacrt baca `IncompleteOnboardingError`.
- `src/core/user/local-user.ts`: `LOCAL_USER_ID` dok ne stigne auth (korak 18).
- UI: `src/ui/` dobio `Button`, `Stepper` (s accessibility adjustable akcijama), `TextField`, `ChoiceGroup`; `src/features/onboarding/` — `OnboardingFlow` (4 ekrana, Natrag/Dalje, Dalje onemogućen dok korak nije ispravan; promjena jezika odmah prevodi UI; vremena obavijesti prate san dok ih korisnik ručno ne pomakne) i `OnboardingGate` u root layoutu (nema settingsa → onboarding; inače primijeni spremljeni jezik i prikaže tabove).
- i18n HR/EN za sve tekstove onboardinga.
- 23 nova testa (logika + repo, uključujući rollback transakcije). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (189/189), `expo export --platform android` ✅ (4.2 MB).

**Problemi/napomene:**
- Nije pokrenuto na uređaju/simulatoru (web ne radi zbog expo-sqlite bez wasm postavki) — UI je provjeren samo typecheckom, lintom i bundleom.
- Iz punog koncepta onboarding još ima prijavu, Google Calendar, tjedne zadatke, dopuštenje za notifikacije i prvi quest — dolaze s koracima 18, 24, 25, 10 i 34.
- Promjena jezika u Profilu se još ne sprema u settings (Profil i dalje mijenja samo preferenciju u memoriji), pa pri sljedećem pokretanju pobjeđuje jezik iz onboardinga — vidi pitanje 11.

**Pitanja za Bornu:**
10. Koncept traži buđenje **odvojeno za radne dane i vikend** + upozorenje ako je razlika > ~1 h (socijalni jetlag), a `settings` ima samo jedan `wakeTime`. Da dodam `weekendWakeTime` (nova migracija) i drugi stepper u onboardingu, ili zasad ostaje jedno vrijeme?
11. Profil nudi "Jezik uređaja", a `settings.language` može biti samo `hr`/`en`. Da dodam `system` kao dopuštenu vrijednost u settings (pa Profil sprema izbor), ili Profil sprema samo hr/en?
12. Zadana vremena: jutarnja obavijest = vrijeme buđenja, večernji upit = 1 h prije wind-downa (07:00/8 h → 21:15), wind-down 45 min. Odgovara li?
13. Onboarding traži barem 1 zabranu (koncept: "1–3"). Treba li dopustiti preskakanje?

**Sljedeće:** korak 9 — notifikacije (logika): `src/core/notifications/` računa sljedeće okidače (jutro, večer, wind-down) iz settingsa, samo nekoliko dana unaprijed (limit iOS-a), s testovima.

## 2026-11-08 10:43 · Korak 7 — Logika XP-a i streaka
**Plan (recenziran prije koda):**
1. Grana `wip/korak-7`; `npm ci`. Bez novih ovisnosti.
2. `src/core/time/local-date.ts` (čisto): `addDays(date, n)`, `daysBetween(a, b)` nad `YYYY-MM-DD` (UTC aritmetika, bez vremenskih zona i DST-a). Testovi: prijelaz mjeseca/godine, prijestupna godina, negativni pomaci.
3. `src/core/gamification/xp.ts`: tablica XP-a točno iz koncepta (lagani/srednji/teški zadatak 10/25/50, +5 u planiranom terminu, zabrana 5/10/20 po težini, večernji upit 15, krevet ±30 min 20, buđenje bez snoozea 10, preraspoređeno s objašnjenjem 5) kao konstante + čiste funkcije koje vraćaju iznos (i `source` iz `XP_SOURCES`) za svaku akciju. Samo izračun iznosa — bez pisanja u bazu (to je korak 12).
4. Agregacija iz `xp_events` ("izvedeno, ne spremljeno"): `totalXp(events)`, `xpForDate(events, date)`, `xpByDate(events)`. Bez levela (faza 3).
5. `src/core/gamification/streak.ts`: glavni streak = dani zaredom s ispunjenom večernjom provjerom. `isEveningCheckinComplete` (večernji checkin s ocjenom dana — ocjena je zadnji obavezni korak provjere), generička `streakFromDates(dates, today)` → `{ current, longest, lastDate, doneToday }`: duplikati se ignoriraju, streak je živ ako je zadnji dan danas ili jučer (današnji upit još nije propušten), datumi iz budućnosti se ignoriraju. `mainStreak(checkins, today)` je preko nje. Generička funkcija služi kasnije i za streakove po zabrani (korak 28).
6. Freeze tokeni **nisu** u ovom koraku (BUILD_PLAN: "freeze kasnije", koncept: faza 3) — samo ostaviti API koji ih kasnije može primiti.
7. Testovi za sve (rubovi: prazno, samo danas, prekid jučer, prekid prije 2 dana, duplikati, budućnost, longest ≠ current, preko mjeseca). Provjere `tsc --noEmit`, `expo lint`, `npm test`.
8. BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = čiste funkcije u `src/core/gamification/` (XP iz eventova, glavni streak iz checkina) + testovi — točke 3–5, 7. Iznosi XP-a i definicija glavnog streaka doslovno iz punog koncepta (Gamifikacija); "nema kazni" poštovano (iznosi > 0, prekršaj ne oduzima). Leveli, freeze, questovi i streak po zabrani ostaju za kasnije korake. Nema UI-ja ni baze. "Ispunjena večernja provjera = postoji ocjena dana" je tehnička interpretacija — zapisuje se kao pitanje.

**Napravljeno:**
- Bez novih ovisnosti.
- `src/core/time/local-date.ts`: `addDays`, `daysBetween` (UTC aritmetika nad `YYYY-MM-DD`, DST ne utječe), `localDateOf(Date)`.
- `src/core/gamification/xp.ts`: `XP_TABLE` doslovno iz koncepta (zadatak 10/25/50 + 5 u terminu, zabrana 5/10/20, upit 15, krevet ±30 min 20, bez snoozea 10, preraspoređeno s objašnjenjem 5); funkcije `xpForTaskDone`, `xpForRuleKept`, `xpForEveningCheckin`, `xpForBedtime` (odstupanje preko ponoći, granica 30 min uključena), `xpForWakeWithoutSnooze`, `xpForRescheduledWithReason` → `{ source, amount }` spremno za `xp_events`; zbrojevi `totalXp`, `xpForDate`, `xpByDate`. `TASK_DIFFICULTIES` (`easy/medium/hard`) definirano ovdje jer tablica `tasks` još ne postoji.
- `src/core/gamification/streak.ts`: generički `streakFromDates(dates, today)` → `{ current, longest, lastDate, doneToday }` (živ ako je zadnji dan danas ili jučer; duplikati, neispravni i budući datumi se ignoriraju); `isEveningCheckinComplete` i `mainStreak(checkins, today)`.
- 26 novih testova. Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (166/166).

**Problemi/napomene:**
- Freeze tokeni, leveli i streak po zabrani namjerno nisu ovdje (faza 3 / korak 28); `streakFromDates` je spreman za ponovnu upotrebu.
- "Preraspoređeno s objašnjenjem" ide pod XP izvor `task` (u `XP_SOURCES` nema zasebnog izvora za iskrsle stvari).
- Spajanje s bazom (pisanje `xp_events`, čitanje checkina) dolazi s koracima 12 i 15.

**Pitanja za Bornu:**
8. Glavni streak računam kao "postoji večernji checkin s ocjenom dana" (ocjena je zadnji obavezni korak provjere). Je li to dovoljno, ili provjera mora biti ispunjena do kraja (i "Što imaš sutra?")?
9. Treba li dan kad je sve "Nešto je iskrslo" (bez upita) čuvati glavni streak, ili to vrijedi samo za streakove zadataka/navika? (Koncept: preraspoređivanje "ne kvari streak".)

**Sljedeće:** korak 8 — onboarding (jezik → buđenje i sati sna → vremena obavijesti → 1–3 zabrane; sprema u settings/rules).

## 2026-11-08 06:43 · Korak 6 — Lokalna baza
**Plan (recenziran prije koda):**
1. Grana `wip/korak-6`; `npm ci`; `expo-sqlite` (SDK 58) + `expo-crypto` (UUID) preko `EXPO_OFFLINE=1 npx expo install`; `drizzle-orm` (stabilni 0.45) i `drizzle-kit` (dev). Config plugin `expo-sqlite` u `app.json` ako ga paket traži.
2. `src/db/schema.ts` (Drizzle `sqliteTable`): 7 tablica iz koraka 5 — `settings`, `schedule_blocks`, `checkins`, `checkin_items`, `rules`, `rule_logs`, `xp_events`; stupci 1:1 s Zod shemama (snake_case u bazi), boolean kao `integer` mode boolean, `activeDays`/`activeHours` kao JSON tekst. Indeksi za upite po danu (`user_id, date`); jedinstveno samo ono što koncept implicira (jedan red settings po korisniku). FK `checkin_items → checkins`, `rule_logs → rules`.
3. Migracije: `drizzle.config.ts` (dialect sqlite, driver expo) → `drizzle-kit generate` u `src/db/migrations/` (SQL + `migrations.js`); Metro `sourceExts += sql` i `babel-plugin-inline-import` da se SQL bundla; pokretanje preko `useMigrations` u root layoutu (ekran greške ako migracija padne).
4. Repo funkcije (`src/db/repos/`), bez Reacta, primaju `db` kao parametar (lako testirati): settings — `getSettings(userId)`, `saveSettings` (upsert); schedule_blocks — `createBlock`, `getBlock`, `listBlocksForDate` (sortirano po početku), `updateBlock` (patch), `deleteBlock`. Ulaz se validira postojećim Zod shemama prije pisanja, izlaz se parsira u domenske tipove; `id`/`createdAt`/`updatedAt` postavlja repo (injektabilni `newId`/`now`).
5. Testovi repoa nad stvarnim SQLite-om u Nodeu (ugrađeni `node:sqlite` preko Drizzle `sqlite-proxy` drivera, iste migracije): migracije se primjenjuju, CRUD radi, neispravan ulaz se odbija i ništa ne piše, `updatedAt` se mijenja, lista po danu je sortirana i filtrirana po korisniku. Ako `node:sqlite` ne radi u jestu → `better-sqlite3` (samo dev).
6. Provjere: `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`.
7. BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = expo-sqlite + Drizzle, sheme i migracije za 7 tablica, CRUD za settings i schedule_blocks — točke 2–5. CRUD za ostale tablice nije tražen (dolazi s koracima 7/8/12). Nema UI-ja osim pokretanja migracija pri startu; nema synca (korak 19), Supabase sheme (17) ni lokalnog korisnika/onboardinga (8) — repo prima `userId` izvana. Drizzle 1.0 je beta → stabilni 0.45. Ne dira `ios/`/`android/`.

**Napravljeno:**
- Paketi: `expo-sqlite` ~58.0.15 (+ config plugin u `app.json`), `expo-crypto` ~58.0.7 (UUID), `drizzle-orm` 0.45.4; dev: `drizzle-kit` 0.31, `babel-plugin-inline-import`, `@types/node` 22 (samo za test adapter).
- `src/db/schema.ts`: 7 tablica (snake_case stupci, boolean kao integer, `active_days`/`active_hours` kao JSON, `sleep_hours` real). Indeksi `(user_id, date)` za dnevne upite, jedinstveni `settings.user_id`, FK `checkin_items → checkins` (cascade), `rule_logs → rules` (cascade) i `→ checkins` (set null).
- Migracije: `drizzle.config.ts` + `npm run db:generate` → `src/db/migrations/0000_init.sql` + `migrations.js`; `babel.config.js` (inline-import `.sql`) i `metro.config.js` (`sourceExts += sql`). SQL je potvrđeno u Android bundleu.
- `src/db/db.ts` (`createDb` — uključuje `foreign_keys`), `src/db/open.ts` (`getDb()` — `ritam.db`, WAL). `src/ui/database-gate.tsx`: `useMigrations` u root layoutu; loader dok traje, poruka (HR/EN) ako padne.
- Repoi (`src/db/repos/`): settings — `getSettings`, `saveSettings` (upsert, `id`/`createdAt` ostaju), `deleteSettings`; schedule_blocks — `createBlock`, `getBlock`, `listBlocksForDate` (po početku), `updateBlock` (patch, cijeli rezultat se validira), `deleteBlock`. Sve po `userId`; ulaz i izlaz kroz Zod sheme iz koraka 5; neispravan ulaz baca `ZodError` i ništa ne piše. `newId`/`now` injektabilni.
- Testovi (`src/db/db.test.ts`, 19): pravi Drizzle expo driver i prave migracije nad Node `node:sqlite` (mali adapter u `src/db/testing/`), CRUD, izolacija po korisniku, odbijanje neispravnog ulaza, FK.
- Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (140/140), `expo export --platform android` ✅ (3.4 MB).

**Problemi/napomene:**
- docs.expo.dev opet nedostupan; korišten SKILL.md iz `node_modules/expo-sqlite` i tipovi Drizzlea. Drizzle 1.0 je još beta → stabilni 0.45.
- Nije pokrenuto na uređaju. expo-sqlite je u Expo Go-u, ali dodan je config plugin → za dev build treba novi build.
- Web nije podešen za expo-sqlite (treba wasm + COOP/COEP zaglavlja) — app je mobilni; ako web zatreba, upute su u `node_modules/expo-sqlite/skills/.../web-and-config.md`.
- Repoi su `async`, ali Drizzle expo driver je sinkron ispod — za male količine podataka ok.
- Jedinstvenost checkina po (korisnik, dan, vrsta) i rule_loga po (zabrana, dan) **nije** nametnuta u bazi (samo indeksi) — vidi pitanje 7.

**Pitanja za Bornu:**
7. Smije li postojati samo jedan jutarnji i jedan večernji checkin po danu (i jedan zapis po zabrani po danu)? Ako da, dodat ću jedinstvene indekse u sljedećoj migraciji.

**Sljedeće:** korak 7 — logika XP-a i streaka (`src/core/gamification/`: XP iz eventova, glavni streak iz checkina) s testovima.

## 2026-11-07 20:43 · Korak 5 — Domenski tipovi
**Plan (recenziran prije koda):**
1. Grana `wip/korak-5`; `npm ci`; `zod` (4.x, čisti JS) preko `expo install` (offline način — Expo API je iza proxyja blokiran).
2. `src/core/domain/common.ts`: zajednički primitivi — `id` (neprazan string), `userId`, `createdAt`/`updatedAt` (ISO datetime), `localDate` (`YYYY-MM-DD`, stvarni datum), `clockTime` (`HH:MM` preko postojećeg `parseClock`), `rating1to5`, `baseEntity` (id, userId, createdAt, updatedAt — "svaka tablica" iz koncepta).
3. Sheme + `z.infer` tipovi, po jedna datoteka, polja točno iz modela podataka u konceptu: `settings`, `schedule_blocks`, `checkins`, `checkin_items`, `rules`, `rule_logs`, `xp_events`. Enumi kao `as const` nizovi (kind, source, status, weight…).
4. Pravila validacije samo tamo gdje ih koncept implicira: ocjene 1–5, težina zabrane 1/2/3, XP `amount` > 0 (bez kazni), blok `end` nakon `start` (osim `sleep` koji smije prijeći ponoć), `activeDays` jedinstveni dani 0–6.
5. `rule_logs` nema u tablici koncepta (spominje se kao izvor streakova) — minimalno: `ruleId`, `date`, `kept`, `trigger?`, `checkinId?` (iz večernjeg upita "Držao sam se / Prekršio sam (+ okidač)"). Zapisati kao pitanje.
6. Testovi validacije: ispravni primjeri prolaze, svaki ključni rub pada (datum 2026-02-30, 24:00, ocjena 0/6, amount 0, end ≤ start, duplikat dana…), `safeParse` bez iznimki.
7. Provjere: `tsc --noEmit`, `expo lint`, `npm test`; BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriterij koraka = tipovi + Zod sheme za 7 navedenih tablica + testovi validacije — točke 2–6. Polja iz koncepta, bez novih značajki; `tasks`, `disruptions`, `reports`, `quests`, `llm_calls` nisu u ovom koraku (kasnije faze). Jedini dodatak izvan popisa polja: `title` na bloku (fixed/sleep blok bez `taskId` mora imati naziv za timeline) — zapisano. Bez baze (korak 6), bez Reacta, bez UI-ja.

**Napravljeno:**
- `zod` 4.6 (jedina nova ovisnost; čisti JS).
- `src/core/domain/` (čisto, bez Reacta): `common.ts` (id, ISO timestamp s vremenskom zonom, `YYYY-MM-DD` sa stvarnom provjerom datuma, `HH:MM`, ocjena 1–5, dan u tjednu 0–6, `baseEntityShape`), `settings.ts`, `schedule-block.ts`, `checkin.ts` (checkins + checkin_items), `rule.ts` (rules + rule_logs), `xp-event.ts`; tipovi preko `z.infer`, enumi kao `as const` nizovi.
- Validacija: blok mora završiti nakon početka (san smije prijeći ponoć), zabrana: težina 1/2/3, barem jedan dan bez duplikata, `activeHours` `null` = cijeli dan i smije prijeći ponoć; rule_log okidač samo kad je zabrana prekršena; XP iznos cijeli i > 0 (bez kazni); `sleepHours` 4–12 u koracima od 15 min; `windDownMinutes` 0–180; nepoznati ključevi se odbacuju.
- 49 novih testova (`domain.test.ts`). Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (121/121), `expo export --platform android` ✅.

**Problemi/napomene:**
- `npx expo install` ne može doći do Expo API-ja (proxy 403) — korišten `EXPO_OFFLINE=1 npx expo install zod`.
- Dodano polje `title` na `schedule_blocks` (nije u popisu polja koncepta, ali timeline treba naziv za blok bez zadatka).
- `settings.language` je `hr | en` kao u konceptu; odabir "Jezik uređaja" iz koraka 3 se zasad ne može spremiti u settings (vidi pitanje 5).
- Granice (sleepHours 4–12, wind-down do 180 min, komentar do 2000 znakova) su tehnički zadane, lako promjenjive.

**Pitanja za Bornu:**
5. Treba li `settings.language` moći biti i "Jezik uređaja" (`system`), ili se jezik uvijek fiksira u onboardingu (koncept kaže `hr/en`)?
6. `rule_logs` nije u tablici koncepta pa sam ga definirao minimalno: zabrana, datum, držao/prekršio, okidač (samo kod prekršaja), veza na večernji checkin. Odgovara li?

**Sljedeće:** korak 6 — lokalna baza (expo-sqlite + Drizzle ORM, sheme i migracije za tablice iz koraka 5, CRUD za settings i schedule_blocks).

## 2026-11-07 13:43 · Korak 4 — Dizajn tokeni
**Plan (recenziran prije koda):**
1. Grana `wip/korak-4`; `npm ci`.
2. NativeWind: docs.expo.dev nedostupan; npm pokazuje da je stabilni NativeWind 4.2.7 vezan uz Tailwind 3 + `react-native-css-interop`, a v5 je još RC — nije provjereno stabilno za SDK 58 / RN 0.88 + React Compiler. Prema kriteriju koraka → **StyleSheet + tokeni**, bez novih ovisnosti. Gradijent preko ugrađenog RN 0.88 stila `backgroundImage: 'linear-gradient(...)'` (tipovi potvrđeni u `node_modules/react-native`), pa ne treba `expo-linear-gradient`.
3. Čisti tokeni u `src/core/theme/` (bez React importa): `palette` (dark primarna + light), semantičke boje (`background`, `surface`, `text`, `textMuted`, `border`, `accent`…), `spacing` (4-pt skala), `radius`, `typography` (veličine/težine/lineHeight, sistemski font), gradijenti `dawn`/`day`/`evening` kao tokeni po shemi.
4. Čiste funkcije: `dayPhaseAt(minuteOfDay)` → `dawn | day | evening` (fiksne granice zasad: zora 05:00–09:00, dan 09:00–18:00, večer ostatak; kasnije se mogu vezati uz vrijeme buđenja — zapisati kao pitanje), `linearGradientCss(gradient)` → CSS string, `contrastRatio(a, b)` (WCAG). Testovi: granice faza, CSS string, kontrast teksta na pozadini/površini ≥ 4.5 i muted ≥ 3 za obje sheme, light i dark imaju iste ključeve.
5. `src/ui/theme/`: `ThemeProvider` + `useTheme()` (shema iz `useColorScheme`, zadano dark kad je `null`; faza dana iz sata, osvježava se svake minute), `navigationTheme` za expo-router `ThemeProvider` iz tokena.
6. Primijeniti tokene: `_layout.tsx` (provider + boje navigacije/tabova), `PlaceholderScreen` (pozadina s gradijentom faze dana), Profil — bez hardkodiranih boja/razmaka.
7. Provjere: `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`.
8. BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriteriji (dark-first paleta, gradijent zora/dan/večer kao tokeni, tipografija, razmaci, radius, tema provider, provjera NativeWinda) pokriveni točkama 2–6. Koncept ne propisuje konkretne boje — paleta je početni prijedlog (topli akcent zbog orb-plamena), lako promjenjiv na jednom mjestu; granice faza dana su tehnički zadane i zapisuju se kao pitanje. Ne uvodi Zustand/bazu/animacije (Skia/Reanimated su faza 3), ne dira `ios/`/`android/`, `app.json` (splash/ikona) ostaje netaknut.

**Napravljeno:**
- Odluka: **StyleSheet + tokeni**, NativeWind nije uveden (stabilni 4.x vezan uz Tailwind 3 + css-interop, 5.x je RC; docs nedostupni za provjeru sa SDK 58). Nema novih ovisnosti.
- `src/core/theme/` (čisto, bez Reacta): `tokens.ts` — paleta, semantičke boje za dark (primarna/zadana) i light, gradijenti `dawn`/`day`/`evening` po shemi, `spacing` (4-pt), `radius`, `typography` (sistemski font); `phase.ts` — `dayPhaseAt`/`dayPhaseOf` (zora 05–09, dan 09–18, večer ostalo) i `linearGradientCss`; `contrast.ts` — WCAG kontrast. 28 testova, uključujući čitljivost teksta na svim pozadinama i gradijentima (≥ 4.5) za obje sheme.
- `src/ui/theme/`: `AppThemeProvider` + `useAppTheme()` (shema iz sustava, tamna kad je nepoznata; faza dana se osvježava svake minute), `navigationThemeFor()` za expo-router. Ime `useAppTheme` da se ne miješa s expo-routerovim `useTheme`.
- `src/ui/text.tsx` (`variant` + `tone`) i `src/ui/gradient-background.tsx` (ugrađeni RN `backgroundImage: linear-gradient`).
- Primijenjeno: tabovi (akcent, boje ikona, pozadina trake), navigacijska tema, placeholder ekrani (gradijent doba dana), Profil — nema više hardkodiranih boja u `src/`.
- Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (72/72), `expo export --platform android` ✅ (3.1 MB).

**Problemi/napomene:**
- Nije viđeno na uređaju — gradijent preko `backgroundImage` zahtijeva New Architecture (zadana u SDK 58); ako se ne prikaže, `backgroundColor` je rezerva. Vrijedi pogledati u `npx expo start`.
- Na iOS 26+ sustav sam crta pozadinu tab trake (`backgroundColor` nema efekta) — očekivano.
- Splash i ikona (`app.json`, plavi #208AEF iz templatea) nisu dirani — to je odluka o brendu.

**Pitanja za Bornu:**
1. Paleta je početni prijedlog: tamna pozadina + topli narančasti akcent (orb-plamen), zora breskva/ruža, dan plavo-tirkizni, večer ljubičasto-indigo. Odgovara li, ili imaš druge boje na umu?
2. Granice doba dana su fiksne (05/09/18 h). Želiš li da kasnije prate tvoje vrijeme buđenja iz onboardinga (npr. zora = buđenje do +3 h)?
3. Treba li svijetla tema uopće, ili app uvijek tamna? (Sad prati sustav, tamna je zadana.)
4. Splash/ikona još su iz templatea — imaš li logo/boju za splash?

**Sljedeće:** korak 5 — domenski tipovi + Zod sheme u `src/core/domain/` (settings, schedule_blocks, checkins, checkin_items, rules, rule_logs, xp_events) s testovima validacije.

## 2026-11-07 10:43 · Korak 3 — i18n
**Plan (recenziran prije koda):**
1. Grana `wip/korak-3`; `npm ci`.
2. Paketi: `npx expo install expo-localization` (SDK 58) + `i18next` i `react-i18next` (čisti JS, kompatibilne verzije s React 19). Config plugin `expo-localization` u `app.json` ako ga paket traži.
3. Čista logika u `src/core/i18n/language.ts` (bez React importa): tipovi `Language = 'hr' | 'en'`, `LanguagePreference = 'system' | Language`; `resolveLanguage(pref, deviceLanguageCodes)` → preferenca ako je ručna, inače prvi podržani jezik uređaja, fallback `en`. Testovi (HR uređaj, EN, nepodržan → en, redoslijed, velika slova/regije poput `hr-HR`).
4. `src/i18n/hr.json`, `en.json` (isti ključevi), `src/i18n/index.ts`: init i18next (`compatibilityJSON` po potrebi, `fallbackLng: 'en'`, bez `escapeValue`), tipizirani ključevi preko `i18next` module augmentation (TS strict). Test da HR i EN imaju identične ključeve.
5. Svi UI stringovi preko `t()`: labeli tabova u `_layout.tsx`, naslovi placeholder ekrana, "Uskoro".
6. Profil: prekidač jezika (Sustav / Hrvatski / English) — jednostavni gumbi bez dizajn tokena (korak 4); `i18n.changeLanguage`. Trajno spremanje preferencije nije u ovom koraku (nema još settings/baze — korak 6/8); zapisati.
7. Provjere: `tsc --noEmit`, `expo lint`, `npm test`, `expo export --platform android`.
8. BUILD_PLAN `[x]`, PROGRESS, merge na `main`, push.

*Recenzija plana:* kriteriji koraka (i18next + react-i18next + expo-localization, `hr.json`/`en.json`, jezik uređaja, prekidač u Profilu, tabovi prevedeni) pokriveni su točkama 2–6. Koncept navodi i18next (HR/EN) — u skladu. Fallback `en` je tehnički izbor za nepodržane jezike uređaja, ne promjena koncepta. Ne uvodi Zustand/bazu ni dizajn tokene; preferencija "sustav" samo u memoriji dok ne postoji settings tablica. Ne dira `ios/`/`android/`.

**Napravljeno:**
- Paketi: `expo-localization` ~58.0.5 (+ config plugin u `app.json`), `i18next` 27, `react-i18next` 18 (`expo install`).
- `src/core/i18n/language.ts`: `resolveLanguage(preferencija, jezici uređaja)` i `toSupportedLanguage` — ručni odabir pobjeđuje, inače prvi podržani jezik uređaja, fallback `en`. 18 testova.
- `src/i18n/hr.json` / `en.json`, `src/i18n/index.ts` (vlastita i18next instanca, sinkroni init, `setLanguagePreference`), `i18next.d.ts` — tipizirani ključevi (`t('tabs.today')` se provjerava u `tsc`). Test da HR i EN imaju iste, neprazne ključeve.
- Labeli tabova, naslovi placeholder ekrana i "Uskoro" idu kroz `t()`. Root layout prati promjenu jezika uređaja (`useLocales`) kad je odabran "Jezik uređaja".
- Profil: odabir jezika (Jezik uređaja / Hrvatski / English), privremeni minimalni stil.
- Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (44/44), `expo export --platform android` ✅ (3 MB).

**Problemi/napomene:**
- Odabir jezika se **ne sprema trajno** — nakon restarta app opet prati jezik uređaja. Spremanje ide u settings (korak 6 baza, korak 8 onboarding s odabirom jezika).
- Nije testirano na uređaju (samo bundle); prekidač vrijedi probati u `npx expo start` (expo-localization je u Expo Go-u, ali dodan config plugin → za dev build treba novi build).
- Nepodržan jezik uređaja (npr. njemački) → engleski. Ako bi Borna radije hrvatski kao zadani, to je jedna konstanta (`FALLBACK_LANGUAGE`).

**Sljedeće:** korak 4 — dizajn tokeni (dark-first paleta, gradijent po dobu dana, tipografija, razmaci, radius, tema provider; provjeriti NativeWind za SDK 58).

## 2026-11-07 06:44 · Korak 2 — Testovi
**Plan (recenziran prije koda):**
1. Grana `wip/korak-2`; `npm ci`.
2. Odabir runnera: provjeriti Expo SDK 58 docs (unit testing). Zadano `jest-expo` (službeni Expo preset, kasnije omogućuje i testove komponenti) preko `npx expo install jest-expo jest @types/jest`; ako ne radi s RN 0.88 / TS 6 → vitest samo za `src/core/**` i zapisati zašto.
3. Konfiguracija: `jest` u `package.json` (preset `jest-expo`, `testMatch` za `src/**/*.test.ts(x)`, ignorirati `node_modules`); skripte `test` i `test:watch`.
4. Sample test nad pravom čistom funkcijom bez React importa: `src/core/time/clock.ts` — `parseClock("HH:MM")` → minute od ponoći i `formatClock(min)` → "HH:MM" (trebat će onboardingu, blokovima i notifikacijama). Neispravan unos → `null`, bez iznimki. Testovi rubnih slučajeva.
5. TS/ESLint: `@types/jest` vidljiv u testovima, lint prolazi za `*.test.ts` (jest globali).
6. Provjere: `npx tsc --noEmit`, `npx expo lint`, `npm test`, `npx expo export --platform android` (testovi ne ulaze u bundle).
7. BUILD_PLAN `[x]`, PROGRESS ažuriran, merge na `main`, push.

*Recenzija plana:* kriterij je "runner + jedan sample test + `npm test`" — točke 2–5 to pokrivaju. `clock.ts` je mala pomoćna funkcija, ne nova značajka ni odluka iz koncepta (format vremena "HH:MM" je neutralan; tipovi/Zod su korak 5 i ovdje se ne uvode). Ne dira UI, i18n ni `ios/`/`android/`.

**Napravljeno:**
- Runner: **Jest 30 + `jest-expo` 58** (dev ovisnosti, `expo install` verzije). Konfiguracija u `package.json`: preset `jest-expo`, `testMatch` = `src/**/*.test.ts(x)`. Skripte `npm test` i `npm run test:watch`.
- Umjesto `@types/jest` koristi se `@jest/globals` s eksplicitnim importima u testovima: TS 6 više ne učitava globalne `@types` automatski, a ovako jest globali ne ulaze u tipove app koda.
- `src/core/time/clock.ts`: `parseClock("HH:MM")` → minute od ponoći / `formatClock(min)` → "HH:MM"; neispravno → `null`. 24 testa (rubni slučajevi + inverz za svaku minutu dana).
- Provjere: `tsc --noEmit` ✅, `expo lint` ✅, `npm test` ✅ (24/24), `expo export --platform android` ✅.

**Problemi/napomene:**
- docs.expo.dev ni ovaj put nije bio dostupan (fetch odbijen) — postavljeno prema README-u iz `node_modules/jest-expo` (SDK 58).
- Preset `jest-expo` vrti testove u RN (iOS) okruženju; za čiste `src/core` testove to je dovoljno, a omogućuje i testove komponenti kasnije.

**Sljedeće:** korak 3 — i18n (i18next + react-i18next + expo-localization, `hr.json`/`en.json`, jezik uređaja, prekidač u Profilu, labeli tabova).

## 2026-11-06 · Korak 1 — Čišćenje templatea + tabovi
**Plan (recenziran prije koda):**
1. Grana `wip/korak-1`; `npm ci`.
2. Obrisati primjer kod templatea: `src/app/explore.tsx`, `src/components/**`, `src/hooks/**`, `src/constants/theme.ts`, `src/global.css`, `scripts/reset-project.js` (+ npm skripta `reset-project`), nekorištene primjer slike (react-logo, expo-badge, expo-logo, logo-glow, tutorial-web, tabIcons).
3. Mape `src/core/`, `src/features/`, `src/ui/` (s kratkim README/`.gitkeep` da postoje u gitu).
4. Tab layout (Expo Router, `src/app/_layout.tsx`) s 5 tabova: Danas (`index`), Tjedan (`week`), Questovi (`quests`), Navike (`habits`), Profil (`profile`). Provjeriti API tabova u docs za SDK 58 (NativeTabs vs JS Tabs, ikone, web podrška).
5. Placeholder ekrani: zajednička komponenta `src/ui/placeholder-screen.tsx` (naslov + "uskoro"), minimalni stil bez dizajn tokena (to je korak 4). Labeli zasad hardkodirani HR — i18n je korak 3.
6. Provjere: `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform android` (bundla se).
7. Označiti korak u BUILD_PLAN, ažurirati PROGRESS, merge na `main`, push.

*Recenzija plana:* odgovara kriterijima (tabovi postoje, bundla se, mape postoje); ne uvodi i18n/tokene/logiku iz kasnijih koraka; ne dira `ios/`/`android/`. Imena ruta na engleskom (stabilni URL-ovi), labeli preko i18n kasnije.

**Napravljeno:**
- Obrisan sav primjer kod i slike templatea (`explore`, `components/`, `hooks/`, `constants/theme.ts`, `global.css`, `reset-project`), README očišćen od reset uputa.
- `src/app/_layout.tsx`: `NativeTabs` (expo-router/native-tabs) s 5 tabova — Danas `index`, Tjedan `week`, Questovi `quests`, Navike `habits`, Profil `profile`; ikone SF Symbol (iOS) + Material (Android). Tamna tema je zadana osim ako je uređaj u svijetlom načinu.
- Placeholder ekrani preko `src/ui/placeholder-screen.tsx`; mape `src/core/`, `src/features/`, `src/ui/` s kratkim README-om.
- ESLint: dodani `eslint` + `eslint-config-expo` (dev) i `eslint.config.js` (flat config) — prije nije bilo konfiguracije.
- Provjere: `tsc --noEmit` ✅ (nestale su 3 greške iz templatea), `expo lint` ✅, `expo export --platform android` ✅ (bundle 2.9 MB).

**Problemi/napomene:**
- U sandboxu je Expo API blokiran proxyjem; `expo lint`/`expo install`/`expo export` rade s `EXPO_OFFLINE=1`. Docs.expo.dev nije bio dostupan — API NativeTabs provjeren iz tipova u `node_modules/expo-router` (SDK 58).
- Splash: uklonjen `preventAutoHideAsync` (template ga je skrivao animiranim overlayem koji je obrisan) — splash se sad skriva automatski.
- Nije testirano na uređaju/emulatoru (samo bundle). Vrijedi jednom pokrenuti `npx expo start` i provjeriti tabove na telefonu.

**Sljedeće:** korak 2 — test runner za `src/core/**` (jest-expo ili vitest) + `npm test`.

## 2026-11-05 · Korak 0 — Skeleton
- Kreiran Expo projekt (default template, Expo SDK 58, Expo Router, TypeScript).
- Dodani `docs/CONCEPT.md`, `docs/BUILD_PLAN.md`, `docs/PROGRESS.md`, `CLAUDE.md`.
- Odluke: osnovni XP + streak već u fazi 1; LLM raspoređivač od prve verzije; Supabase cloud (account kasnije, do tada lokalno).
- Napomena: default template ima 3 TS greške (CSS module importi u `animated-icon.web.tsx`, `constants/theme.ts`, i tip u `app-tabs.web.tsx`) — sve su u primjer kodu koji korak 1 briše.
- **Sljedeće:** korak 1 — čišćenje templatea + 5 tabova.
