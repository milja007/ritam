# Dnevnik napretka

Najnovije na vrhu. Svaka sesija: datum · korak · što je napravljeno · što je sljedeće · problemi/odluke.

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
