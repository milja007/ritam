/**
 * Ciljevi razdoblja (korak 25): početak razdoblja za dan, redoslijed i napredak. Čista logika,
 * bez React importa.
 */
import { isValidLocalDate } from '../domain/common';
import type { Goal, GoalPeriod } from '../domain/goal';
import { weekStart } from '../progress';

/** Prvi dan razdoblja u kojem je `date` (tjedan → ponedjeljak, mjesec → 1., godina → 1. 1.). */
export function goalPeriodStart(period: GoalPeriod, date: string): string | null {
  if (!isValidLocalDate(date)) return null;
  if (period === 'year') return `${date.slice(0, 4)}-01-01`;
  if (period === 'month') return `${date.slice(0, 7)}-01`;
  return weekStart(date);
}

/** Redoslijed prikaza: po `position`, pa po nastanku (stabilno i kad se dva uređaja posvađaju). */
export function sortGoals<T extends Pick<Goal, 'position' | 'createdAt' | 'id'>>(goals: readonly T[]): T[] {
  return [...goals].sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/** Koliko je ciljeva ostvareno od ukupnog broja. */
export function goalProgress(goals: readonly Pick<Goal, 'doneOn'>[]): { done: number; total: number } {
  return { done: goals.filter((goal) => goal.doneOn !== null).length, total: goals.length };
}

/** Sljedeća pozicija za novi cilj (iza zadnjeg). */
export function nextGoalPosition(goals: readonly Pick<Goal, 'position'>[]): number {
  return goals.reduce((max, goal) => Math.max(max, goal.position + 1), 0);
}
