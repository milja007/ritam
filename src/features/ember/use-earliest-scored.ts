import { useState } from 'react';

import { earliestScored } from '@/core/ember';

import type { EmberState } from './use-ember-data';

/**
 * Najraniji dan s konačnim rezultatom, zapamćen i dok se podaci ponovo učitavaju — da se strelica
 * „prethodno“ ne gasi pri svakom listanju (Tjedan pri listanju čita blokove novog tjedna).
 * Stanje se usklađuje u renderu, bez efekta.
 */
export function useEarliestScored(state: EmberState): string | null {
  const [earliest, setEarliest] = useState<string | null>(null);
  if (state.status !== 'ready') return earliest;
  const next = earliestScored(state.data.scores);
  if (next !== earliest) setEarliest(next);
  return next;
}
