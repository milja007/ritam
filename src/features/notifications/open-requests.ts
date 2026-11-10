import { useSyncExternalStore } from 'react';

import type { PermissionDecision } from '@/core/notifications';

/**
 * Zahtjevi iz obavijesti prema ekranima (npr. dodir večernje obavijesti → večernji upit, Iskrslo na
 * podsjetniku → uređivač bloka) i signal da su se blokovi promijenili izvan ekrana (Gotovo na obavijesti).
 * Obavijest stiže izvan React stabla, pa se zahtjev pamti dok ga ekran ne preuzme.
 */
type State = {
  morning: boolean;
  evening: boolean;
  blockId: string | null;
  blocksVersion: number;
  /** Zadnje poznato stanje dopuštenja za obavijesti (`null` dok ga sync ne provjeri). */
  permission: PermissionDecision | null;
};

let state: State = { morning: false, evening: false, blockId: null, blocksVersion: 0, permission: null };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Dodir jutarnje obavijesti → jutarnji brief. */
export function requestMorningBrief(): void {
  set({ morning: true });
}

/** Ekran je otvorio brief — zahtjev se briše. */
export function consumeMorningRequest(): void {
  if (state.morning) set({ morning: false });
}

/** Je li zatražen jutarnji brief (dok ga ekran ne preuzme s `consumeMorningRequest`). */
export function useMorningRequested(): boolean {
  return useSyncExternalStore(subscribe, () => state.morning, () => false);
}

export function requestEveningCheckin(): void {
  set({ evening: true });
}

/** Ekran je otvorio upit — zahtjev se briše. */
export function consumeEveningRequest(): void {
  if (state.evening) set({ evening: false });
}

/** Je li zatražen večernji upit (dok ga ekran ne preuzme s `consumeEveningRequest`). */
export function useEveningRequested(): boolean {
  return useSyncExternalStore(subscribe, () => state.evening, () => false);
}

/** Otvori blok u uređivaču na tabu Danas (Iskrslo / dodir podsjetnika). */
export function requestOpenBlock(blockId: string): void {
  set({ blockId });
}

export function consumeBlockRequest(): void {
  if (state.blockId !== null) set({ blockId: null });
}

/** Id bloka koji treba otvoriti, dok ga ekran ne preuzme s `consumeBlockRequest`. */
export function useBlockRequested(): string | null {
  return useSyncExternalStore(subscribe, () => state.blockId, () => null);
}

/** Blokovi su se promijenili izvan ekrana (npr. Gotovo na obavijesti) — ekrani neka ponovo učitaju. */
export function notifyBlocksChanged(): void {
  set({ blocksVersion: state.blocksVersion + 1 });
}

/** Broj koji raste pri svakoj vanjskoj promjeni blokova (za ovisnosti učitavanja). */
export function useBlocksVersion(): number {
  return useSyncExternalStore(subscribe, () => state.blocksVersion, () => 0);
}

/** Sync javlja stanje dopuštenja nakon svake provjere. */
export function setPermissionDecision(permission: PermissionDecision): void {
  if (state.permission !== permission) set({ permission });
}

/** Stanje dopuštenja za obavijesti (`null` dok nije provjereno). */
export function usePermissionDecision(): PermissionDecision | null {
  return useSyncExternalStore(subscribe, () => state.permission, () => null);
}
