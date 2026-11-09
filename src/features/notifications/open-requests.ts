import { useSyncExternalStore } from 'react';

/**
 * Zahtjev za otvaranje ekrana iz obavijesti (npr. dodir večernje obavijesti → večernji upit).
 * Obavijest stiže izvan React stabla, pa se zahtjev pamti dok ga ekran ne preuzme.
 */
let eveningRequested = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function requestEveningCheckin(): void {
  eveningRequested = true;
  emit();
}

/** Ekran je otvorio upit — zahtjev se briše. */
export function consumeEveningRequest(): void {
  if (!eveningRequested) return;
  eveningRequested = false;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Je li zatražen večernji upit (dok ga ekran ne preuzme s `consumeEveningRequest`). */
export function useEveningRequested(): boolean {
  return useSyncExternalStore(subscribe, () => eveningRequested, () => false);
}
