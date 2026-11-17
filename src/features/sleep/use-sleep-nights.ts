import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { Checkin } from '@/core/domain';
import { SLEEP_WEEK_NIGHTS } from '@/core/sleep';
import { addDays } from '@/core/time/local-date';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listMorningCheckins } from '@/db/repos';
import { useProgressVersion } from '@/features/progress';

type Morning = Pick<Checkin, 'date' | 'sleepStart' | 'wakeTime'>;

export type SleepNightsState =
  | { status: 'loading'; mornings: null }
  | { status: 'error'; mornings: null }
  | { status: 'ready'; mornings: Morning[] };

/**
 * Jutarnje prijave sna zadnjih 7 dana do `today` (kartica sna na Profilu). Ponovo se učitaju pri
 * povratku na tab i nakon spremanja prijave (`notifyProgressChanged`).
 */
export function useSleepNights(today: string): SleepNightsState {
  const [loaded, setLoaded] = useState<{ key: string; state: SleepNightsState } | null>(null);
  const [version, setVersion] = useState(0);
  const progressVersion = useProgressVersion();
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useFocusEffect(reload);

  useEffect(() => {
    let active = true;
    const from = addDays(today, -(SLEEP_WEEK_NIGHTS - 1)) ?? today;
    listMorningCheckins(getDb(), LOCAL_USER_ID, from, today)
      .then((mornings) => {
        if (active) setLoaded({ key: today, state: { status: 'ready', mornings } });
      })
      .catch((error: unknown) => {
        console.error('Loading sleep nights failed', error);
        if (active) setLoaded({ key: today, state: { status: 'error', mornings: null } });
      });
    return () => {
      active = false;
    };
  }, [today, version, progressVersion]);

  return loaded?.key === today ? loaded.state : { status: 'loading', mornings: null };
}
