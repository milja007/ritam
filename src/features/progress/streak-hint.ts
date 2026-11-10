import type { Streak } from '@/core/gamification';

/** Ključ poticajne poruke uz streak (bez kazni: prekid samo poziva na novi početak). */
export function streakHintKey(streak: Streak) {
  if (streak.doneToday) return 'progress.streak.hintDone' as const;
  if (streak.current > 0) return 'progress.streak.hintKeep' as const;
  return 'progress.streak.hintStart' as const;
}
