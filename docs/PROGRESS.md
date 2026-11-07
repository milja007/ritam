# Dnevnik napretka

Najnovije na vrhu. Svaka sesija: datum · korak · što je napravljeno · što je sljedeće · problemi/odluke.

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
