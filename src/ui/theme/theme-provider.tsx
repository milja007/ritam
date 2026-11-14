import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { wakeTimeFor } from '@/core/schedule';
import {
  type ColorScheme,
  type ColorThemeId,
  type DayPhase,
  dayPhaseOf,
  DEFAULT_SCHEME,
  PHASE_STARTS,
  phaseStartsFor,
  radius,
  spacing,
  type Theme,
  themeFor,
  typography,
} from '@/core/theme';
import { localDateOf } from '@/core/time/local-date';

import { useColorTheme } from './color-theme';
import { usePhaseAnchor } from './phase-anchor';

export type AppTheme = Theme & {
  /** Trenutno doba dana (zora/dan/večer, prema buđenju) — osvježava se svake minute. */
  phase: DayPhase;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

const PHASE_REFRESH_MS = 60_000;

function useDayPhase(): DayPhase {
  const anchor = usePhaseAnchor();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), PHASE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  // Granice prema današnjem buđenju (vikend ili radni dan); bez postavki fiksne.
  const starts =
    anchor === null
      ? PHASE_STARTS
      : (phaseStartsFor(wakeTimeFor(anchor, localDateOf(now)), anchor.sleepHours) ?? PHASE_STARTS);
  return dayPhaseOf(now, starts);
}

function buildTheme(scheme: ColorScheme, phase: DayPhase, colorTheme?: ColorThemeId): AppTheme {
  return { ...themeFor(scheme, colorTheme), phase, spacing, radius, typography };
}

const AppThemeContext = createContext<AppTheme>(buildTheme(DEFAULT_SCHEME, dayPhaseOf(new Date())));

/**
 * Tema aplikacije: shema prati sustav (dark-first — tamna kad sustav ne javi
 * shemu), faza dana prati sat, a tema boja plamena je korisnikov odabir (pamti se na uređaju).
 * `scheme` i `colorTheme` propovi služe za testove/preglede i za uzorke tema u biraču.
 */
export function AppThemeProvider({
  children,
  scheme,
  colorTheme,
}: PropsWithChildren<{ scheme?: ColorScheme; colorTheme?: ColorThemeId }>) {
  const systemScheme = useColorScheme();
  const resolved: ColorScheme = scheme ?? (systemScheme === 'light' ? 'light' : DEFAULT_SCHEME);
  const phase = useDayPhase();
  const stored = useColorTheme();
  const flameTheme = colorTheme ?? stored;
  const value = useMemo(() => buildTheme(resolved, phase, flameTheme), [resolved, phase, flameTheme]);
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

/** Tokeni trenutne teme. (Ime nije `useTheme` da se ne miješa s expo-routerovim.) */
export function useAppTheme(): AppTheme {
  return useContext(AppThemeContext);
}
