import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { ScheduleBlock } from '@/core/domain';
import { finalScores } from '@/core/ember';
import type { ScoredDay } from '@/core/progress';
import { countsForStreak } from '@/core/gamification/streak';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listBlocksBetween, listDayScores, listEveningCheckins } from '@/db/repos';
import { useBlocksVersion } from '@/features/notifications';
import { useProgressVersion } from '@/features/progress';

export type EmberData = {
  /** Konačni dnevni rezultati po danu. */
  scores: ReadonlyMap<string, number>;
  /** Svi ocijenjeni dani do `checkinDay` (i „u tijeku“), s dijelovima rezultata — za rang i statove. */
  days: readonly ScoredDay[];
  /** Dani koji se računaju u glavni niz (ispunjen večernji upit ili „Odustajem“) do `checkinDay`. */
  streakDates: readonly string[];
  /** Blokovi traženog raspona (prazno ako raspon nije zadan). */
  blocks: readonly ScheduleBlock[];
};

type Loaded = { key: string; data: EmberData | null };

export type EmberState =
  | { status: 'loading'; data: null; reload: () => void }
  | { status: 'error'; data: null; reload: () => void }
  | { status: 'ready'; data: EmberData; reload: () => void };

/**
 * Lokalni podaci za žar: konačni dnevni rezultati do `checkinDay` i (opcionalno) blokovi raspona.
 * Osvježava se kao `useDayScore`: na promjenu napretka, Gotovo iz obavijesti i pri fokusu taba.
 */
export function useEmberData(checkinDay: string, range?: { from: string; to: string }): EmberState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const progressVersion = useProgressVersion();
  const blocksVersion = useBlocksVersion();
  const from = range?.from ?? null;
  const to = range?.to ?? null;
  const key = `${checkinDay}|${from ?? ''}|${to ?? ''}`;

  useFocusEffect(
    useCallback(() => {
      setVersion((v) => v + 1);
    }, []),
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      const db = getDb();
      const history = listDayScores(db, LOCAL_USER_ID, checkinDay);
      const blocks = from !== null && to !== null ? await listBlocksBetween(db, LOCAL_USER_ID, from, to) : [];
      const evenings = await listEveningCheckins(db, LOCAL_USER_ID);
      const streakDates = evenings
        .filter((checkin) => checkin.date <= checkinDay && countsForStreak(checkin))
        .map((checkin) => checkin.date);
      return { scores: finalScores(history.days), days: history.days, streakDates, blocks };
    };
    // Čitanje baze odgodi iza prvog crtanja.
    const handle = setTimeout(() => {
      load()
        .then((data) => {
          if (active) setLoaded({ key, data });
        })
        .catch((error: unknown) => {
          console.error('Loading ember data failed', error);
          if (active) setLoaded({ key, data: null });
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [key, checkinDay, from, to, progressVersion, blocksVersion, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  if (loaded === null || loaded.key !== key) return { status: 'loading', data: null, reload };
  return loaded.data === null
    ? { status: 'error', data: null, reload }
    : { status: 'ready', data: loaded.data, reload };
}
