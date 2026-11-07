import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import {
  type ColorScheme,
  type DayPhase,
  dayPhaseOf,
  DEFAULT_SCHEME,
  radius,
  spacing,
  type Theme,
  themes,
  typography,
} from '@/core/theme';

export type AppTheme = Theme & {
  /** Trenutno doba dana (zora/dan/večer) — osvježava se svake minute. */
  phase: DayPhase;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

const PHASE_REFRESH_MS = 60_000;

function useDayPhase(): DayPhase {
  const [phase, setPhase] = useState<DayPhase>(() => dayPhaseOf(new Date()));
  useEffect(() => {
    const id = setInterval(() => setPhase(dayPhaseOf(new Date())), PHASE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return phase;
}

function buildTheme(scheme: ColorScheme, phase: DayPhase): AppTheme {
  return { ...themes[scheme], phase, spacing, radius, typography };
}

const AppThemeContext = createContext<AppTheme>(buildTheme(DEFAULT_SCHEME, dayPhaseOf(new Date())));

/**
 * Tema aplikacije: shema prati sustav (dark-first — tamna kad sustav ne javi
 * shemu), a faza dana prati sat. `scheme` prop služi za testove/preglede.
 */
export function AppThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: ColorScheme }>) {
  const systemScheme = useColorScheme();
  const resolved: ColorScheme = scheme ?? (systemScheme === 'light' ? 'light' : DEFAULT_SCHEME);
  const phase = useDayPhase();
  const value = useMemo(() => buildTheme(resolved, phase), [resolved, phase]);
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

/** Tokeni trenutne teme. (Ime nije `useTheme` da se ne miješa s expo-routerovim.) */
export function useAppTheme(): AppTheme {
  return useContext(AppThemeContext);
}
