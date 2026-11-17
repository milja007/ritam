import { useState } from 'react';

import { freezeEarned } from '@/core/gamification';

type Seen = { held: number | null; earned: boolean; id: number };

/**
 * Je li žeravica zarađena dok je ekran otvoren (bljesak na Profilu). `held` je `null` dok se
 * napredak učitava — prvo učitano stanje zato ne bljesne. `id` raste pri svakoj promjeni broja.
 * Stanje se usklađuje u renderu (bez efekta), isti uzorak kao `useStreakGain`.
 */
export function useFreezeEarned(held: number | null): { earned: boolean; id: number } {
  const [seen, setSeen] = useState<Seen>({ held, earned: false, id: 0 });
  if (seen.held === held) return seen;
  const next: Seen = { held, earned: held !== null && freezeEarned(seen.held, held), id: seen.id + 1 };
  setSeen(next);
  return next;
}
