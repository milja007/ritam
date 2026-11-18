import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { TrackerEntry } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { addTrackerEntry, deleteTrackerEntry, listTrackerEntries, type TrackerEntryInput } from '@/db/repos';
import { notifyProgressChanged, useProgressVersion } from '@/features/progress';

/** Promjena unosa (Dan, večernji upit) — svi prikazi trackera ponovo čitaju. */
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function notifyTrackersChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
  // Unos trackera mijenja rezultat dana (P2 Codexa, PR #50) — i prikazi napretka neka ponovo čitaju.
  notifyProgressChanged();
}

/**
 * Unosi trackera za dane `from`–`to`. `entries` je `null` kad čitanje ne uspije.
 * `add` / `remove` vraćaju je li uspjelo i osvježe sve prikaze.
 */
export function useTrackerEntries(from: string, to: string) {
  const changes = useSyncExternalStore(subscribe, () => version, () => 0);
  // Sync s drugog uređaja javlja `notifyProgressChanged` (sync-runner) — unosi se tada ponovo čitaju (P2 Codexa, PR #49).
  const progress = useProgressVersion();
  // Mali sinkroni upit (jedan dan do mjesec dana) — čita se pri crtanju, bez dodatnog stanja.
  const entries = useMemo((): TrackerEntry[] | null => {
    void changes;
    void progress;
    try {
      return listTrackerEntries(getDb(), LOCAL_USER_ID, from, to);
    } catch (error: unknown) {
      console.error('Loading tracker entries failed', error);
      return null;
    }
  }, [from, to, changes, progress]);

  const add = useCallback((input: TrackerEntryInput): boolean => {
    try {
      addTrackerEntry(getDb(), LOCAL_USER_ID, input);
      notifyTrackersChanged();
      return true;
    } catch (error: unknown) {
      console.error('Adding tracker entry failed', error);
      return false;
    }
  }, []);

  const remove = useCallback((id: string): boolean => {
    try {
      const removed = deleteTrackerEntry(getDb(), LOCAL_USER_ID, id);
      notifyTrackersChanged();
      return removed;
    } catch (error: unknown) {
      console.error('Removing tracker entry failed', error);
      return false;
    }
  }, []);

  return { entries, add, remove };
}
