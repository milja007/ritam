import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { Goal, GoalPeriod } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listGoals } from '@/db/repos';

type Loaded = { key: string } & (
  | { status: 'ready'; goals: Goal[] }
  | { status: 'error'; goals: null }
);

export type GoalsState =
  | { status: 'loading'; goals: null }
  | { status: 'error'; goals: null }
  | { status: 'ready'; goals: Goal[] };

/**
 * Ciljevi jednog razdoblja iz lokalne baze. Ponovo se učitaju pri povratku na tab, kad se
 * razdoblje promijeni (strelice) i na `reload()` (nakon svake promjene na kartici).
 */
export function useGoals(period: GoalPeriod, periodStart: string): GoalsState & { reload: () => void } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = `${period}|${periodStart}`;

  useFocusEffect(reload);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => listGoals(getDb(), LOCAL_USER_ID, period, periodStart))
      .then((goals) => {
        if (active) setLoaded({ key, status: 'ready', goals });
      })
      .catch((error: unknown) => {
        console.error('Loading goals failed', error);
        if (active) setLoaded({ key, status: 'error', goals: null });
      });
    return () => {
      active = false;
    };
  }, [key, period, periodStart, version]);

  // Podaci drugog razdoblja (prije nego se novo učita) se ne prikazuju.
  const state: GoalsState =
    loaded === null || loaded.key !== key
      ? { status: 'loading', goals: null }
      : loaded.status === 'ready'
        ? { status: 'ready', goals: loaded.goals }
        : { status: 'error', goals: null };
  return { ...state, reload };
}
