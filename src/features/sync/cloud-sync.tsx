import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/auth';

import { runSync } from './sync-runner';

/**
 * Sync u pozadini ekrana: pri pokretanju (čim je sesija poznata), odmah nakon prijave i pri
 * svakom povratku appa u prvi plan. Bez flaga ili prijave ne radi ništa.
 */
export function CloudSync() {
  const session = useSession();
  const userId = session.status === 'signedIn' ? session.userId : null;

  useEffect(() => {
    if (userId === null) return;
    void runSync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runSync();
    });
    return () => subscription.remove();
  }, [userId]);

  return null;
}
