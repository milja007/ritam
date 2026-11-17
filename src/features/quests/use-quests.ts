import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { Quest } from '@/core/domain';
import { LOCAL_USER_ID } from '@/core/user/local-user';
import { getDb } from '@/db/open';
import { listQuests } from '@/db/repos';
import { useProgressVersion } from '@/features/progress';

export type QuestsState =
  | { status: 'loading'; quests: null }
  | { status: 'error'; quests: null }
  | { status: 'ready'; quests: Quest[] };

/**
 * Epski questovi iz lokalne baze (Profil). Ponovo se učitaju pri povratku na tab, nakon promjene
 * napretka (`notifyProgressChanged` — svaka promjena questa mijenja XP) i na `reload()`.
 */
export function useQuests(): QuestsState & { reload: () => void } {
  const [state, setState] = useState<QuestsState>({ status: 'loading', quests: null });
  const [version, setVersion] = useState(0);
  const progressVersion = useProgressVersion();
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useFocusEffect(reload);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => listQuests(getDb(), LOCAL_USER_ID))
      .then((quests) => {
        if (active) setState({ status: 'ready', quests });
      })
      .catch((error: unknown) => {
        console.error('Loading quests failed', error);
        if (active) setState({ status: 'error', quests: null });
      });
    return () => {
      active = false;
    };
  }, [version, progressVersion]);

  return { ...state, reload };
}
