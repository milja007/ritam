import { useSyncExternalStore } from 'react';

import { type ColorThemeId, colorThemeOr, DEFAULT_COLOR_THEME } from '@/core/theme';

import { readDevicePref, writeDevicePref } from '../device-prefs';

const KEY = 'ritam.colorTheme';

/** Odabrana tema boja plamena (korak 38). Pamti se na uređaju; `null` = još nije pročitana. */
let current: ColorThemeId | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getColorTheme(): ColorThemeId {
  current ??= colorThemeOr(readDevicePref(KEY));
  return current;
}

/** Odaberi temu: vrijedi odmah u cijeloj aplikaciji i pamti se za sljedeće pokretanje. */
export function setColorTheme(next: ColorThemeId): void {
  if (getColorTheme() === next) return;
  current = next;
  writeDevicePref(KEY, next);
  for (const listener of listeners) listener();
}

export function useColorTheme(): ColorThemeId {
  return useSyncExternalStore(subscribe, getColorTheme, () => DEFAULT_COLOR_THEME);
}
