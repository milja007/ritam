import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSupabase } from './supabase';

export type SessionState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; email: string | null; userId: string };

function fromSession(session: Session | null): SessionState {
  if (!session) return { status: 'signedOut' };
  return { status: 'signedIn', email: session.user.email ?? null, userId: session.user.id };
}

/** Trenutna Supabase sesija; `disabled` kad je auth iza isključenog flaga. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    getSupabase() ? { status: 'loading' } : { status: 'disabled' },
  );

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState(fromSession(data.session));
      })
      .catch((error: unknown) => {
        console.error('Reading the session failed', error);
        if (active) setState({ status: 'signedOut' });
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState(fromSession(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
