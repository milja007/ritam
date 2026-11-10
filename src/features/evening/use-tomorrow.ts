import { useCallback, useEffect, useState } from 'react';

import type { ScheduleBlock } from '@/core/domain';
import {
  learnedQuickPicks,
  LEARNED_WINDOW_DAYS,
  tomorrowInputs,
  wakeTimeFor,
  type BlockDraft,
  type LearnedPick,
} from '@/core/schedule';
import { addDays } from '@/core/time/local-date';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { createBlocks, getSettings, listBlocksBetween, listBlocksForDate } from '@/db/repos';
import { syncNotificationsNow } from '@/features/notifications';

/** Zadano buđenje ako postavke (još) nisu spremljene — isto kao u onboardingu. */
const FALLBACK_WAKE_TIME = '07:00';

type Loaded = {
  date: string;
  status: 'ready' | 'error';
  existing: ScheduleBlock[];
  /** Blokovi koji se ponavljaju u zadnja 4 tjedna, u svom uobičajenom terminu. */
  learned: LearnedPick[];
  wakeTime: string;
};

/**
 * Podaci za "Što imaš sutra?": blokovi koji su za taj dan već u planu (npr. premješteni iz
 * "kad kasnije?"), naučeni brzi odabiri iz zadnja 4 tjedna i vrijeme buđenja (od njega se slažu termini). `confirm` sprema sve nove
 * blokove odjednom; greška ide pozivatelju.
 */
export function useTomorrowPlan(date: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const db = getDb();
    const from = addDays(date, -LEARNED_WINDOW_DAYS) ?? date;
    const until = addDays(date, -1) ?? date;
    Promise.all([
      listBlocksForDate(db, LOCAL_USER_ID, date),
      getSettings(db, LOCAL_USER_ID),
      listBlocksBetween(db, LOCAL_USER_ID, from, until),
    ])
      .then(([existing, settings, history]) => {
        if (active) {
          setLoaded({
            date,
            status: 'ready',
            existing,
            learned: learnedQuickPicks(
              history,
              date,
              existing.map((block) => block.title),
            ),
            // Sutrašnje buđenje (vikendom vikend vrijeme).
            wakeTime: settings ? wakeTimeFor(settings, date) : FALLBACK_WAKE_TIME,
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
            learned: [],
            wakeTime: FALLBACK_WAKE_TIME,
          });
      });
    return () => {
      active = false;
    };
  }, [date, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const confirm = useCallback(
    (drafts: readonly BlockDraft[]) => {
      const count = createBlocks(getDb(), LOCAL_USER_ID, tomorrowInputs(drafts, date)).length;
      // Novi blokovi za sutra dobivaju podsjetnike.
      void syncNotificationsNow();
      return count;
    },
    [date],
  );

  const current = loaded?.date === date ? loaded : null;
  return {
    status: current?.status ?? 'loading',
    existing: current?.existing ?? [],
    learned: current?.learned ?? [],
    wakeTime: current?.wakeTime ?? FALLBACK_WAKE_TIME,
    reload,
    confirm,
  };
}
