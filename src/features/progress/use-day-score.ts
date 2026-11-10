import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { progressOverview, type ProgressOverview } from '@/core/progress';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listDayScores } from '@/db/repos';
import { useBlocksVersion } from '@/features/notifications';

import { useProgressVersion } from './use-progress';

type Loaded =
  | { key: string; status: 'ready'; overview: ProgressOverview }
  | { key: string; status: 'error'; overview: null };

export type DayScoreState =
  | { status: 'loading'; overview: null }
  | { status: 'error'; overview: null }
  | { status: 'ready'; overview: ProgressOverview };

/**
 * Dnevni rezultat i usporedbe za dan upita (`checkinDay`, prije 04:00 jučer). Osvježava se kao
 * `useProgress`: na `notifyProgressChanged()` (kvačica, upit, jutarnja prijava), na Gotovo iz
 * obavijesti i pri fokusu taba.
 */
export function useDayScore(checkinDay: string): DayScoreState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const progressVersion = useProgressVersion();
  const blocksVersion = useBlocksVersion();

  useFocusEffect(
    useCallback(() => {
      setFocusVersion((v) => v + 1);
    }, []),
  );

  useEffect(() => {
    let active = true;
    // Sinkrono čitanje baze odgodi iza prvog crtanja.
    const handle = setTimeout(() => {
      try {
        const history = listDayScores(getDb(), LOCAL_USER_ID, checkinDay);
        const overview = progressOverview(history.days, checkinDay, history.longestStreak);
        if (active) setLoaded({ key: checkinDay, status: 'ready', overview });
      } catch (error: unknown) {
        console.error('Loading day score failed', error);
        if (active) setLoaded({ key: checkinDay, status: 'error', overview: null });
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [checkinDay, progressVersion, blocksVersion, focusVersion]);

  if (loaded === null || loaded.key !== checkinDay) return { status: 'loading', overview: null };
  return loaded.status === 'ready'
    ? { status: 'ready', overview: loaded.overview }
    : { status: 'error', overview: null };
}
