import { z } from 'zod';

import { baseEntityShape, isValidLocalDate, localDateSchema } from './common';

/** Razdoblje plana kojem cilj pripada (koncept: ciljevi žive u tjednom, mjesečnom i godišnjem planu). */
export const GOAL_PERIODS = ['week', 'month', 'year'] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

/** Najviše ciljeva po razdoblju — plan ostaje pregledan („ne mora se sve ispuniti“). */
export const MAX_GOALS_PER_PERIOD = 5;

/**
 * Je li `start` prvi dan razdoblja: tjedan počinje ponedjeljkom, mjesec 1. u mjesecu, godina 1. 1.
 * Čisto (bez ovisnosti o `progress`), da domena ostane najniži sloj.
 */
export function isGoalPeriodStart(period: GoalPeriod, start: string): boolean {
  if (!isValidLocalDate(start)) return false;
  if (period === 'year') return start.endsWith('-01-01');
  if (period === 'month') return start.endsWith('-01');
  const [y, m, d] = start.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay() === 1;
}

/**
 * Cilj razdoblja (korak 25, 25b): kratak naslov u tjednom / mjesečnom / godišnjem planu, kontekst
 * za dan. Bez XP-a (koncept ga ne traži); „ostvaren“ je dan kad ga je korisnik označio.
 */
export const goalSchema = z
  .object({
    ...baseEntityShape,
    period: z.enum(GOAL_PERIODS),
    /** Prvi dan razdoblja ("YYYY-MM-DD"). */
    periodStart: localDateSchema,
    title: z.string().trim().min(1).max(120),
    /** Redoslijed unutar razdoblja (0 = prvi). */
    position: z.number().int().min(0).max(999),
    /** Dan kad je ostvaren; `null` = još nije. */
    doneOn: localDateSchema.nullable(),
  })
  .refine((goal) => isGoalPeriodStart(goal.period, goal.periodStart), {
    message: 'periodStart must be the first day of its period',
    path: ['periodStart'],
  });

export type Goal = z.infer<typeof goalSchema>;
