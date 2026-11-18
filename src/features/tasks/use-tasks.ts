import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { Task } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listTasks } from '@/db/repos';

type Loaded = { key: string } & ({ status: 'ready'; tasks: Task[] } | { status: 'error'; tasks: null });

export type TasksState =
  { status: 'loading'; tasks: null } | { status: 'error'; tasks: null } | { status: 'ready'; tasks: Task[] };

/**
 * Tjedni zadaci iz lokalne baze. Ponovo se učitaju pri povratku na tab, kad se tjedan promijeni
 * (strelice) i na `reload()` (nakon svake promjene na kartici).
 */
export function useTasks(weekStart: string): TasksState & { reload: () => void } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useFocusEffect(reload);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => listTasks(getDb(), LOCAL_USER_ID, weekStart))
      .then((tasks) => {
        if (active) setLoaded({ key: weekStart, status: 'ready', tasks });
      })
      .catch((error: unknown) => {
        console.error('Loading tasks failed', error);
        if (active) setLoaded({ key: weekStart, status: 'error', tasks: null });
      });
    return () => {
      active = false;
    };
  }, [weekStart, version]);

  // Zadaci drugog tjedna (prije nego se novi učitaju) se ne prikazuju.
  const state: TasksState =
    loaded === null || loaded.key !== weekStart
      ? { status: 'loading', tasks: null }
      : loaded.status === 'ready'
        ? { status: 'ready', tasks: loaded.tasks }
        : { status: 'error', tasks: null };
  return { ...state, reload };
}
