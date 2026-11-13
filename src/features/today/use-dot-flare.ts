import { useState } from 'react';

import { shouldFlareDot, type RailState } from '@/core/ember';

type Seen = { state: RailState; id: number; flare: number };

/**
 * Povod za bljesak točke na traci (korak 35): raste kad točka zasvijetli jače dok je redak na
 * ekranu (aktivnost upravo prijavljena). 0 = bez bljeska — prvo crtanje i gašenje ne animiraju.
 * Stanje se usklađuje u renderu (bez efekta), isti uzorak kao `useXpGain`.
 */
export function useDotFlare(state: RailState): number {
  const [seen, setSeen] = useState<Seen>({ state, id: 0, flare: 0 });
  if (seen.state === state) return seen.flare;
  const id = seen.id + 1;
  const next: Seen = { state, id, flare: shouldFlareDot(seen.state, state) ? id : 0 };
  setSeen(next);
  return next.flare;
}
