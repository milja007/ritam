import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

import type { LevelProgress, LevelUp } from '@/core/gamification';
import { LEVEL_UP_DELAY_MS } from '@/core/theme';
import { useProgress } from '@/features/progress';

import { LevelUpCelebration } from './level-up-celebration';
import { shownAfterPendingChange } from './level-up-gate';
import { acknowledgeLevel, useLevelUp } from './level-up-store';

export type LevelUpState = {
  /** Level-up koji čeka slavlje. */
  pending: LevelUp | null;
  /** Napredak unutar trenutne razine; `null` dok se učitava. */
  level: LevelProgress | null;
};

/** Čeka li neka nova razina slavlje (iz zadnje viđene razine i trenutnog XP-a). */
export function useLevelUpState(today: string, checkinDay: string): LevelUpState {
  const progress = useProgress(today, checkinDay);
  const level = progress.status === 'ready' ? progress.summary.level : null;
  const pending = useLevelUp(level?.level ?? null);
  return { pending, level };
}

type Props = {
  state: LevelUpState;
  /** Otvoren je neki drugi modal (upit, plan, list aktivnosti) — slavlje čeka da se zatvori. */
  blocked: boolean;
};

/**
 * Prikazuje slavlje nove razine kad je ekran u fokusu i ništa drugo nije otvoreno, uz kratku pauzu
 * (iOS ne prikaže novi modal dok se prethodni zatvara). Jednom prikazano ostaje do zatvaranja;
 * zatvaranjem se razina bilježi kao viđena, pa se slavlje ne ponavlja. Ako slavlje nestane samo od
 * sebe (napredak se ponovno učitava pri promjeni dana), „prikazano“ se briše — kad se isti
 * level-up vrati, opet čeka fokus, zatvorene modale i pauzu.
 */
export function LevelUpHost({ state, blocked }: Props) {
  const focused = useIsFocused();
  const { pending, level } = state;
  const key = pending === null ? null : `${pending.from}-${pending.to}`;
  const ready = key !== null && focused && !blocked;
  const [shownKey, setShownKey] = useState<string | null>(null);
  // Usklađivanje stanja tijekom crtanja (bez efekta): nestali level-up više nije „prikazan“.
  const kept = shownAfterPendingChange(shownKey, key);
  if (kept !== shownKey) setShownKey(kept);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setShownKey(key), LEVEL_UP_DELAY_MS);
    return () => clearTimeout(id);
  }, [ready, key]);

  if (pending === null || level === null || kept !== key) return null;
  return <LevelUpCelebration levelUp={pending} level={level} onClose={() => acknowledgeLevel(pending.to)} />;
}
