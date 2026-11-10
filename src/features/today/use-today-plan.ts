import { useCallback, useEffect, useState } from 'react';

import { OWN_IDEAS_WINDOW_DAYS, ownIdeas, tomorrowInputs, type BlockDraft, type PlanIdea } from '@/core/schedule';
import { addDays } from '@/core/time/local-date';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { createBlocks, listBlocksBetween } from '@/db/repos';
import { syncNotificationsNow } from '@/features/notifications';
import { notifyProgressChanged } from '@/features/progress';

type Loaded = { date: string; status: 'ready' | 'error'; own: PlanIdea[] };

/**
 * Podaci za plan za danas: vlastite ideje iz onoga što je korisnik upisivao zadnja 4 tjedna.
 * `confirm` sprema sve nove blokove odjednom (redoslijed po početku); greška ide pozivatelju.
 */
export function useTodayPlan(date: string, existingTitles: readonly string[]) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const titlesKey = existingTitles.join('\n');

  useEffect(() => {
    let active = true;
    const from = addDays(date, -OWN_IDEAS_WINDOW_DAYS) ?? date;
    const until = addDays(date, -1) ?? date;
    listBlocksBetween(getDb(), LOCAL_USER_ID, from, until)
      .then((history) => {
        if (active) {
          setLoaded({ date, status: 'ready', own: ownIdeas(history, date, titlesKey.split('\n')) });
        }
      })
      .catch((error: unknown) => {
        console.error('Loading today plan failed', error);
        if (active) setLoaded({ date, status: 'error', own: [] });
      });
    return () => {
      active = false;
    };
  }, [date, titlesKey, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const confirm = useCallback(
    (drafts: readonly BlockDraft[]) => {
      const count = createBlocks(getDb(), LOCAL_USER_ID, tomorrowInputs(drafts, date)).length;
      notifyProgressChanged(); // rezultat dana ovisi o planu
      void syncNotificationsNow(); // podsjetnici za nove blokove
      return count;
    },
    [date],
  );

  const current = loaded?.date === date ? loaded : null;
  return { status: current?.status ?? 'loading', own: current?.own ?? [], reload, confirm };
}
