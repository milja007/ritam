import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { progressSummary, type ProgressSummary } from '@/core/gamification';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listEveningCheckins, listXpEvents } from '@/db/repos';
import { useBlocksVersion } from '@/features/notifications';

/**
 * Napredak (XP, razina, glavni streak) izveden iz lokalne baze. Ekrani koji zapisuju XP ili upit
 * javljaju `notifyProgressChanged()`; Gotovo na obavijesti stiže kroz `useBlocksVersion`.
 */
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** XP ili upiti su se promijenili — prikazi napretka neka ponovo učitaju. */
export function notifyProgressChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function useProgressVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

type Loaded =
  | { key: string; status: 'ready'; summary: ProgressSummary }
  | { key: string; status: 'error'; summary: null };

export type ProgressState =
  | { status: 'loading'; summary: null }
  | { status: 'error'; summary: null }
  | { status: 'ready'; summary: ProgressSummary };

/**
 * @param today kalendarski dan (XP danas)
 * @param checkinDay dan večernjeg upita (prije 04:00 jučer) — prema njemu se računa streak
 */
export function useProgress(today: string, checkinDay: string): ProgressState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const progressVersion = useProgressVersion();
  const blocksVersion = useBlocksVersion();

  // Tabovi ostaju montirani: pri povratku na tab učitaj svježe brojeve.
  useFocusEffect(
    useCallback(() => {
      setFocusVersion((v) => v + 1);
    }, []),
  );

  const key = `${today}|${checkinDay}`;

  useEffect(() => {
    let active = true;
    const db = getDb();
    Promise.all([listXpEvents(db, LOCAL_USER_ID), listEveningCheckins(db, LOCAL_USER_ID)])
      .then(([events, checkins]) => {
        if (!active) return;
        setLoaded({
          key,
          status: 'ready',
          summary: progressSummary(events, checkins, today, checkinDay),
        });
      })
      .catch((error: unknown) => {
        console.error('Loading progress failed', error);
        if (active) setLoaded({ key, status: 'error', summary: null });
      });
    return () => {
      active = false;
    };
  }, [key, today, checkinDay, progressVersion, blocksVersion, focusVersion]);

  // Zadnji učitani brojevi ostaju vidljivi dok se ne osvježe (bez treperenja); novi dan → učitavanje.
  if (loaded === null || loaded.key !== key) return { status: 'loading', summary: null };
  return loaded.status === 'ready'
    ? { status: 'ready', summary: loaded.summary }
    : { status: 'error', summary: null };
}
