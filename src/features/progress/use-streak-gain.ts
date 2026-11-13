import { useState } from 'react';

import { streakGain } from '@/core/gamification';

type Seen = { streak: number | null; gain: number; id: number };

/**
 * Rast niza između dva crtanja (za bljesak pilule niza, korak 35). `streak` je `null` dok se
 * napredak učitava — prvi učitani niz zato ne bljesne. `id` raste pri svakoj promjeni niza.
 * Stanje se usklađuje u renderu (bez efekta), isti uzorak kao `useXpGain`.
 */
export function useStreakGain(streak: number | null): { gain: number; id: number } {
  const [seen, setSeen] = useState<Seen>({ streak, gain: 0, id: 0 });
  if (seen.streak === streak) return seen;
  const next: Seen = { streak, gain: streak === null ? 0 : streakGain(seen.streak, streak), id: seen.id + 1 };
  setSeen(next);
  return next;
}
