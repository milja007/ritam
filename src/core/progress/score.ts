/**
 * Dnevni rezultat 0–100 (korak 16b, koncept "Napredak u odnosu na prošlost"): udio odrađenog
 * plana, poštovane zabrane i san na vrijeme. Što se taj dan ne bilježi, ne ulazi — prisutni
 * dijelovi imaju jednaku težinu. Trackeri (kalorije, novac) dolaze u koraku 31b.
 * Čista logika: bez React importa.
 */
import { BEDTIME_TOLERANCE_MINUTES } from '../gamification/xp';

/** Odstupanje kreveta od cilja na kojem san više ne donosi bodove (2 h). */
export const SLEEP_ZERO_AT_MINUTES = 120;

export const SCORE_PARTS = ['plan', 'rules', 'sleep'] as const;
export type ScorePart = (typeof SCORE_PARTS)[number];

/** Ono što rezultat treba od statistike dana (`DayStats` iz dijagnoze to zadovoljava). */
export type ScoreInput = {
  plan: { total: number; done: number; partial: number };
  rules: { activeWeight: number; keptWeight: number };
  sleep: { deviationMinutes: number | null } | null;
};

export type DayScore = {
  /** 0–100, `null` kad taj dan nema nijednog dijela. */
  score: number | null;
  /** Dijelovi 0–1; `null` = nije zabilježeno, ne ulazi. */
  parts: Record<ScorePart, number | null>;
};

/** San: unutar ±30 min od cilja = 1, zatim linearno do 0 na 2 h odstupanja. */
export function sleepPart(deviationMinutes: number): number {
  if (deviationMinutes <= BEDTIME_TOLERANCE_MINUTES) return 1;
  if (deviationMinutes >= SLEEP_ZERO_AT_MINUTES) return 0;
  return (SLEEP_ZERO_AT_MINUTES - deviationMinutes) / (SLEEP_ZERO_AT_MINUTES - BEDTIME_TOLERANCE_MINUTES);
}

export function dayScore(input: ScoreInput): DayScore {
  const { plan, rules, sleep } = input;
  const parts: DayScore['parts'] = {
    plan: plan.total > 0 ? (plan.done + plan.partial / 2) / plan.total : null,
    rules: rules.activeWeight > 0 ? rules.keptWeight / rules.activeWeight : null,
    sleep: sleep && sleep.deviationMinutes !== null ? sleepPart(sleep.deviationMinutes) : null,
  };
  const present = SCORE_PARTS.map((part) => parts[part]).filter((value): value is number => value !== null);
  if (present.length === 0) return { score: null, parts };
  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  return { score: Math.round(Math.min(1, Math.max(0, mean)) * 100), parts };
}
