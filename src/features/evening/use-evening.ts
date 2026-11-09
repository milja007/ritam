import { useCallback, useEffect, useState } from 'react';

import { rulesActiveOn, type EveningDraft, type SavedEveningCheckin } from '@/core/checkin';
import type { Rule } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getEveningCheckin, listRules, saveEveningCheckin } from '@/db/repos';

type Loaded = {
  date: string;
  status: 'ready' | 'error';
  activeRules: Rule[];
  saved: SavedEveningCheckin | null;
};

/**
 * Podaci večernjeg upita za zadani dan: zabrane koje taj dan vrijede i već spremljeni upit.
 * Blokove dana daje timeline (isti popis koji korisnik vidi na tabu Danas).
 */
export function useEveningCheckin(date: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const db = getDb();
    Promise.all([listRules(db, LOCAL_USER_ID), getEveningCheckin(db, LOCAL_USER_ID, date)])
      .then(([rules, saved]) => {
        if (active) setLoaded({ date, status: 'ready', activeRules: rulesActiveOn(rules, date), saved });
      })
      .catch((error: unknown) => {
        console.error('Loading evening check-in failed', error);
        if (active) setLoaded({ date, status: 'error', activeRules: [], saved: null });
      });
    return () => {
      active = false;
    };
  }, [date, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** Sprema upit (sinkrona transakcija) i vraća zarađeni XP. Greška ide pozivatelju. */
  const save = useCallback(
    (draft: EveningDraft) => {
      const result = saveEveningCheckin(getDb(), LOCAL_USER_ID, date, draft);
      reload();
      return result.xpEarned;
    },
    [date, reload],
  );

  const current = loaded?.date === date ? loaded : null;
  return {
    status: current?.status ?? 'loading',
    activeRules: current?.activeRules ?? [],
    saved: current?.saved ?? null,
    reload,
    save,
  };
}
