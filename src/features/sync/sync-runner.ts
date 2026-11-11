import { useSyncExternalStore } from 'react';

import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { lastSyncAt, syncOnce } from '@/db/sync';
import { getSupabase } from '@/features/auth/supabase';
import { notifyBlocksChanged, syncNotificationsNow } from '@/features/notifications';
import { notifyProgressChanged } from '@/features/progress';
import { loadSettings } from '@/features/settings';

import { createSupabaseRemote } from './supabase-remote';

/**
 * Pokretanje synca (korak 19): jedan prolaz u isto vrijeme; poziv dok prolaz traje traži još
 * jedan nakon njega (promjena se ne gubi). Bez flaga ili prijave ne radi ništa.
 */
export type SyncStatus = {
  state: 'idle' | 'syncing' | 'error';
  lastSyncAt: string | null;
  error: string | null;
};

let status: SyncStatus = { state: 'idle', lastSyncAt: null, error: null };
let loadedLastSync = false;
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;
let again = false;

function publish(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function ensureLastSyncLoaded() {
  if (loadedLastSync) return;
  loadedLastSync = true;
  try {
    status = { ...status, lastSyncAt: lastSyncAt(getDb()) };
  } catch {
    // Baza još nije spremna — zadnje vrijeme stiže s prvim prolazom.
  }
}

async function runOnce(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;

  publish({ state: 'syncing', error: null });
  try {
    const result = await syncOnce(getDb(), createSupabaseRemote(supabase), {
      localUserId: LOCAL_USER_ID,
      remoteUserId: userId,
    });
    publish({ state: 'idle', lastSyncAt: result.finishedAt, error: null });
    if (result.applied > 0 || result.removedLocally > 0) {
      // Podaci s drugog uređaja: osvježi ekrane, postavke (jezik, tema) i obavijesti.
      await loadSettings().catch((error: unknown) => console.error('Reloading settings after sync failed', error));
      notifyBlocksChanged();
      notifyProgressChanged();
      void syncNotificationsNow();
    }
  } catch (error) {
    console.error('Sync failed', error);
    publish({ state: 'error', error: error instanceof Error ? error.message : String(error) });
  }
}

/** Pokreni sync sada (pri pokretanju, povratku u prvi plan, prijavi, ili na dodir). */
export function runSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

export function useSyncStatus(): SyncStatus {
  ensureLastSyncLoaded();
  return useSyncExternalStore(subscribe, () => status, () => status);
}
