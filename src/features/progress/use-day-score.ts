import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { scoreHeadline, type ScoreHeadline } from '@/core/progress';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listDayScores } from '@/db/repos';
import { useBlocksVersion } from '@/features/notifications';

import { useProgressVersion } from './use-progress';

type Loaded =
  | { key: string; status: 'ready'; headline: ScoreHeadline }
  | { key: string; status: 'error'; headline: null };

export type DayScoreState =
  | { status: 'loading'; headline: null }
  | { status: 'error'; headline: null }
  | { status: 'ready'; headline: ScoreHeadline };

/**
 * Dnevni rezultat i usporedbe za dan upita (`checkinDay`, prije 04:00 jučer): do upita istaknut
 * jučerašnji konačni, uz današnji "u tijeku" (korak 16c). Osvježava se kao
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
        const headline = scoreHeadline(history.days, checkinDay, history.longestStreak);
        if (active) setLoaded({ key: checkinDay, status: 'ready', headline });
      } catch (error: unknown) {
        console.error('Loading day score failed', error);
        if (active) setLoaded({ key: checkinDay, status: 'error', headline: null });
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [checkinDay, progressVersion, blocksVersion, focusVersion]);

  if (loaded === null || loaded.key !== checkinDay) return { status: 'loading', headline: null };
  return loaded.status === 'ready'
    ? { status: 'ready', headline: loaded.headline }
    : { status: 'error', headline: null };
}
