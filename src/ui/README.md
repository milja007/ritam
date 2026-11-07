# src/ui

Zajedničke prezentacijske komponente i tema.

- Tokeni (boje, gradijenti doba dana, razmaci, radius, tipografija) su čisti podaci u `src/core/theme/` — mijenjaju se samo tamo.
- `theme/` — `AppThemeProvider` (shema prati sustav, dark-first; faza dana prati sat) i `useAppTheme()`; `navigationThemeFor()` za expo-router.
- `text.tsx` — `<Text variant tone>` s tipografskim tokenima. `gradient-background.tsx` — pozadina s gradijentom faze dana (RN `backgroundImage`).
- Stil: `StyleSheet` + tokeni (NativeWind nije uveden — vidi PROGRESS.md, korak 4). Bez hardkodiranih boja u komponentama.
