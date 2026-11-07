# Dnevnik napretka

Najnovije na vrhu. Svaka sesija: datum · korak · što je napravljeno · što je sljedeće · problemi/odluke.

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
