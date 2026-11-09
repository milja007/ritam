import { useCallback, useEffect, useState } from 'react';

import { rulesActiveOn, type EveningDraft, type SavedEveningCheckin } from '@/core/checkin';
import type { Rule, ScheduleBlock } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getEveningCheckin, listBlocksForDate, listRules, saveEveningCheckin } from '@/db/repos';

type Loaded = {
  date: string;
  status: 'ready' | 'error';
  blocks: ScheduleBlock[];
  activeRules: Rule[];
  saved: SavedEveningCheckin | null;
};

/**
 * Podaci večernjeg upita za zadani dan: blokovi tog dana, zabrane koje taj dan vrijede i već
 * spremljeni upit. Dan upita nije uvijek današnji timeline — prije 04:00 je to jučer.
 */
export function useEveningCheckin(date: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const db = getDb();
    Promise.all([
      listBlocksForDate(db, LOCAL_USER_ID, date),
      listRules(db, LOCAL_USER_ID),
      getEveningCheckin(db, LOCAL_USER_ID, date),
    ])
      .then(([blocks, rules, saved]) => {
        if (active) {
          setLoaded({ date, status: 'ready', blocks, activeRules: rulesActiveOn(rules, date), saved });
        }
      })
      .catch((error: unknown) => {
        console.error('Loading evening check-in failed', error);
        if (active) setLoaded({ date, status: 'error', blocks: [], activeRules: [], saved: null });
      });
    return () => {
      active = false;
    };
  }, [date, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** Sprema upit (sinkrona transakcija) i vraća zarađeni XP. Greška ide pozivatelju. */
  const save = useCallback(
    (draft: EveningDraft) => {
      const result = saveEveningCheckin(getDb(), LOCAL_USER_ID, draft);
      reload();
      return result.xpEarned;
    },
    [reload],
  );

  const current = loaded?.date === date ? loaded : null;
  return {
    status: current?.status ?? 'loading',
    blocks: current?.blocks ?? [],
    activeRules: current?.activeRules ?? [],
    saved: current?.saved ?? null,
    reload,
    save,
  };
}
