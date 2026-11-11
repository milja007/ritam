import { useSyncExternalStore } from 'react';

/** Stanje obrade zadnjeg povratnog linka prijave — za poruku u odjeljku Račun. */
export type AuthLinkStatus = 'idle' | 'working' | 'done' | 'failed';

let status: AuthLinkStatus = 'idle';
const listeners = new Set<() => void>();

export function setAuthLinkStatus(next: AuthLinkStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuthLinkStatus(): AuthLinkStatus {
  return useSyncExternalStore(subscribe, () => status);
}
