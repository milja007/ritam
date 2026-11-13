import { useSyncExternalStore } from 'react';

/**
 * Mjesec odabran dodirom u Godini (Ž10), za tab Mjesec. Tabovi su odvojeni ekrani, pa odabir
 * stoji ovdje — izvan React stabla, kao zahtjevi iz obavijesti
 * (`features/notifications/open-requests.ts`). `null` znači tekući mjesec.
 */
let selected: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(next: string | null) {
  if (selected === next) return;
  selected = next;
  for (const listener of listeners) listener();
}

/** Dodir mjeseca u Godini → tab Mjesec prikazuje taj mjesec ("YYYY-MM"). */
export function selectMonth(month: string): void {
  set(month);
}

/** „Ovaj mjesec“ u Mjesecu → natrag na tekući. */
export function clearSelectedMonth(): void {
  set(null);
}

/** Odabrani mjesec, ili `null` za tekući. */
export function useSelectedMonth(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => selected,
    () => null,
  );
}
