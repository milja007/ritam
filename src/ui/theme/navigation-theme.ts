import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';

import type { Theme } from '@/core/theme';

/** Tema za expo-router/React Navigation izvedena iz naših tokena. */
export function navigationThemeFor(theme: Theme): NavigationTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.scheme === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}
