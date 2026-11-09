# Dnevnik napretka

Najnovije na vrhu. Svaka sesija: datum · korak · što je napravljeno · što je sljedeće · problemi/odluke.

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
