import { useCallback, useEffect, useState } from 'react';

import type { ScheduleBlock } from '@/core/domain';
import { tomorrowInputs, type BlockDraft } from '@/core/schedule';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { createBlocks, getSettings, listBlocksForDate } from '@/db/repos';

/** Zadano buđenje ako postavke (još) nisu spremljene — isto kao u onboardingu. */
const FALLBACK_WAKE_TIME = '07:00';

type Loaded = {
  date: string;
  status: 'ready' | 'error';
  existing: ScheduleBlock[];
  wakeTime: string;
};

/**
 * Podaci za "Što imaš sutra?": blokovi koji su za taj dan već u planu (npr. premješteni iz
 * "kad kasnije?") i vrijeme buđenja (od njega se slažu termini). `confirm` sprema sve nove
 * blokove odjednom; greška ide pozivatelju.
 */
export function useTomorrowPlan(date: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const db = getDb();
    Promise.all([listBlocksForDate(db, LOCAL_USER_ID, date), getSettings(db, LOCAL_USER_ID)])
      .then(([existing, settings]) => {
        if (active) {
          setLoaded({
            date,
            status: 'ready',
            existing,
            wakeTime: settings?.wakeTime ?? FALLBACK_WAKE_TIME,
          });
        }
      })
      .catch((error: unknown) => {
        console.error('Loading tomorrow plan failed', error);
        if (active)
          setLoaded({
            date,
            status: 'error',
            existing: [],
            wakeTime: FALLBACK_WAKE_TIME,
          });
      });
    return () => {
      active = false;
    };
  }, [date, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const confirm = useCallback(
    (drafts: readonly BlockDraft[]) =>
      createBlocks(getDb(), LOCAL_USER_ID, tomorrowInputs(drafts, date)).length,
    [date],
  );

  const current = loaded?.date === date ? loaded : null;
  return {
    status: current?.status ?? 'loading',
    existing: current?.existing ?? [],
    wakeTime: current?.wakeTime ?? FALLBACK_WAKE_TIME,
    reload,
    confirm,
  };
}
