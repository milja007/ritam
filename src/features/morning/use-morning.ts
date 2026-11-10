import { useCallback, useEffect, useState } from 'react';

import type { MorningDraft } from '@/core/checkin';
import type { Checkin } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { getMorningCheckin, saveMorningCheckin } from '@/db/repos';
import { useSettings } from '@/features/settings';

type Loaded = { date: string; status: 'ready' | 'error'; saved: Checkin | null };

/** Jutarnja prijava sna zadanog dana (spremljena ili `null`) + spremanje. */
export function useMorningCheckin(date: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const { settings } = useSettings();

  useEffect(() => {
    let active = true;
    getMorningCheckin(getDb(), LOCAL_USER_ID, date)
      .then((saved) => {
        if (active) setLoaded({ date, status: 'ready', saved });
      })
      .catch((error: unknown) => {
        console.error('Loading morning check-in failed', error);
        if (active) setLoaded({ date, status: 'error', saved: null });
      });
    return () => {
      active = false;
    };
  }, [date, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** Sprema prijavu (sinkrona transakcija) i vraća zarađeni XP. Greška ide pozivatelju. */
  const save = useCallback(
    (draft: MorningDraft) => {
      if (settings === null) throw new Error('Settings are not loaded');
      const result = saveMorningCheckin(getDb(), LOCAL_USER_ID, settings, draft);
      reload();
      return result.xpEarned;
    },
    [settings, reload],
  );

  const current = loaded?.date === date ? loaded : null;
  return {
    status: settings === null ? 'loading' : (current?.status ?? 'loading'),
    settings,
    saved: current?.saved ?? null,
    reload,
    save,
  };
}
