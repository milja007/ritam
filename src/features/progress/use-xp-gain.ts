import { useState } from 'react';

import { xpGain } from '@/core/gamification';

type Seen = { total: number | null; gain: number; id: number };

/**
 * Dobitak XP-a između dva crtanja (za „+N XP“). `total` je `null` dok se napredak učitava —
 * prvi učitani iznos zato ne animira. `id` raste pri svakoj promjeni ukupnog XP-a.
 * Stanje se usklađuje u renderu (bez efekta), po uzorku „prethodna vrijednost propa“.
 */
export function useXpGain(total: number | null): { gain: number; id: number } {
  const [seen, setSeen] = useState<Seen>({ total, gain: 0, id: 0 });
  if (seen.total === total) return seen;
  const next: Seen = { total, gain: total === null ? 0 : xpGain(seen.total, total), id: seen.id + 1 };
  setSeen(next);
  return next;
}
