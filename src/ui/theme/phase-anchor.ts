import { useSyncExternalStore } from 'react';

import type { SleepSettings } from '@/core/schedule';

/**
 * Buđenje (radni dan / vikend) i sati sna za granice doba dana. Postavke se učitavaju ispod
 * `AppThemeProvider`a (iza baze), pa ih sloj postavki javlja ovdje; do tada vrijede fiksne granice.
 */
let anchor: SleepSettings | null = null;
const listeners = new Set<() => void>();

export function setPhaseAnchor(next: SleepSettings | null): void {
  if (
    anchor?.wakeTime === next?.wakeTime &&
    anchor?.weekendWakeTime === next?.weekendWakeTime &&
    anchor?.sleepHours === next?.sleepHours
  ) {
    return;
  }
  anchor = next === null ? null : { ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePhaseAnchor(): SleepSettings | null {
  return useSyncExternalStore(subscribe, () => anchor, () => null);
}
