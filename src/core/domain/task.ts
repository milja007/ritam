import { z } from 'zod';

import { baseEntityShape, isValidLocalDate, localDateSchema } from './common';
import { isGoalPeriodStart } from './goal';

/** Doba dana u kojem se zadatak smije odraditi (tvrdo pravilo smještanja). */
export const TASK_PARTS_OF_DAY = ['any', 'morning', 'afternoon', 'evening'] as const;
export type TaskPartOfDay = (typeof TASK_PARTS_OF_DAY)[number];

/** Koliko energije zadatak traži (visoka → ranije u danu, niska → kasnije). */
export const TASK_ENERGIES = ['low', 'medium', 'high'] as const;
export type TaskEnergy = (typeof TASK_ENERGIES)[number];

/** Najviše tjednih zadataka po tjednu — tjedan ostaje pregledan („ne mora se sve ispuniti“). */
export const MAX_TASKS_PER_WEEK = 10;
export const TASK_MIN_DURATION = 5;
export const TASK_MAX_DURATION = 480;
export const TASK_MAX_TIMES = 7;
export const TASK_NEEDS_MAX = 300;

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

/** Je li `deadline` dan unutar tjedna koji počinje `weekStart` (pon–ned). */
export function isDeadlineInWeek(weekStart: string, deadline: string): boolean {
  if (!isValidLocalDate(weekStart) || !isValidLocalDate(deadline)) return false;
  return deadline >= weekStart && deadline <= addDaysIso(weekStart, 6);
}

/**
 * Tjedni zadatak (korak 25; koncept „Tjedni zadaci: pitanja kod unosa — trajanje, rok, koliko puta,
 * doba dana, što treba, energija“). Smješta se u dane tjedna kao blokovi vrste Zadatak s `taskId`;
 * napredak se čita iz tih blokova, pa zadatak sam nema stanje „gotovo“.
 */
export const taskSchema = z
  .object({
    ...baseEntityShape,
    /** Ponedjeljak tjedna ("YYYY-MM-DD"). */
    weekStart: localDateSchema,
    title: z.string().trim().min(1).max(120),
    /** Trajanje jednog puta u minutama. */
    durationMinutes: z.number().int().min(TASK_MIN_DURATION).max(TASK_MAX_DURATION),
    /** Koliko puta u tjednu (svaki put drugi dan). */
    timesPerWeek: z.number().int().min(1).max(TASK_MAX_TIMES),
    /** Zadnji dan do kojeg mora biti gotovo; `null` = do kraja tjedna. */
    deadline: localDateSchema.nullable(),
    partOfDay: z.enum(TASK_PARTS_OF_DAY),
    energy: z.enum(TASK_ENERGIES),
    /** Što treba (pribor, mjesto, osoba…); prazno = ništa posebno. */
    needs: z.string().trim().max(TASK_NEEDS_MAX),
  })
  .superRefine((task, ctx) => {
    if (!isGoalPeriodStart('week', task.weekStart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['weekStart'],
        message: 'weekStart must be a Monday',
      });
    }
    if (task.deadline !== null && !isDeadlineInWeek(task.weekStart, task.deadline)) {
      ctx.addIssue({
        code: 'custom',
        path: ['deadline'],
        message: 'deadline must be within the week',
      });
    }
  });

export type Task = z.infer<typeof taskSchema>;

/** Polja koja korisnik upisuje (odgovori na pitanja). */
export type TaskInput = Pick<
  Task,
  'weekStart' | 'title' | 'durationMinutes' | 'timesPerWeek' | 'deadline' | 'partOfDay' | 'energy' | 'needs'
>;
