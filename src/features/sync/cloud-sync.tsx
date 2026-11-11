import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getDb } from '@/db/open';
import { queueSize } from '@/db/sync';
import { useSession } from '@/features/auth';

import { runSync } from './sync-runner';

/** P74: lokalne promjene idu na poslužitelj najkasnije ~10 s nakon izmjene (dok je app otvoren). */
const PENDING_CHECK_MS = 10_000;

function pushIfPending() {
  if (AppState.currentState !== 'active') return;
  try {
    if (queueSize(getDb()) > 0) void runSync();
  } catch (error) {
    console.error('Checking the sync queue failed', error);
  }
}

/**
 * Sync u pozadini ekrana: pri pokretanju (čim je sesija poznata), odmah nakon prijave i pri
 * svakom povratku appa u prvi plan, te kad u redu ima lokalnih promjena (provjera svakih 10 s,
 * samo lokalni upit). Bez flaga ili prijave ne radi ništa.
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
    const timer = setInterval(pushIfPending, PENDING_CHECK_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [userId]);

  return null;
}
