import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { nextHaptic, type HapticEvent, type HapticKind, type HapticState } from '@/core/haptics';

import { readDevicePref, writeDevicePref } from './device-prefs';

const KEY = 'ritam.haptics';

/** Haptika postoji samo na mobitelu; na webu prekidač se ne prikazuje i ništa ne svira. */
export const HAPTICS_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

/** Uključena po defaultu; isključuje se na Profilu. Pamti se na uređaju (ne sinkronizira se). */
let enabled: boolean | null = null;
let last: HapticState = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHapticsEnabled(): boolean {
  enabled ??= readDevicePref(KEY) !== 'off';
  return enabled;
}

export function setHapticsEnabled(next: boolean): void {
  if (getHapticsEnabled() === next) return;
  enabled = next;
  writeDevicePref(KEY, next ? 'on' : 'off');
  for (const listener of listeners) listener();
  // Uključivanje se odmah osjeti, da korisnik zna kako zvuči.
  if (next) playHaptic('done');
}

export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(subscribe, getHapticsEnabled, () => true);
}

function play(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'selection':
      return Haptics.selectionAsync();
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

/**
 * Odsviraj osjet za povod (Ž11). Povodi u istom trenutku se spajaju (`nextHaptic`). Haptika je
 * ukras: greška uređaja (npr. Taptic Engine nedostupan, štednja baterije) se samo zabilježi.
 */
export function playHaptic(event: HapticEvent): void {
  if (!HAPTICS_SUPPORTED || !getHapticsEnabled()) return;
  const next = nextHaptic(last, event, Date.now());
  last = next.state;
  if (next.play === null) return;
  play(next.play).catch((error: unknown) => {
    console.warn('Haptic feedback failed', event, error);
  });
}

/** Samo za testove: zaboravi zadnji osjet i pročitanu postavku. */
export function resetHapticsForTests(): void {
  enabled = null;
  last = null;
}
